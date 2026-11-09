import "server-only";
import type Stripe from "stripe";
import { admin } from "@/lib/supabase/admin";
import { AppError, enforceRateLimit } from "@/lib/server/session";
import { canWithdraw, entitlementFromSubscription } from "./access";
import { getStripe } from "./stripe";

async function ensureCustomer(stripe: Stripe, userId: string, email: string | undefined): Promise<string> {
  const db = admin();
  const { data: existing } = await db.from("stripe_customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (existing) return existing.stripe_customer_id;
  const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
  await db.from("stripe_customers").insert({ user_id: userId, stripe_customer_id: customer.id });
  return customer.id;
}

/** Sessão de pagamento incorporada na página. O servidor nunca vê dados do cartão. */
export async function createCheckoutSession(userId: string, email: string | undefined): Promise<string> {
  await enforceRateLimit(`checkout:${userId}`, 10, 3600);
  const db = admin();
  const { data: active } = await db
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1);
  if (active?.length) throw new AppError("invalid", "Você já tem uma assinatura ativa.");

  const stripe = getStripe();
  const customer = await ensureCustomer(stripe, userId, email);
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "subscription",
    customer,
    locale: "pt-BR",
    allowed_payment_method_types: ["card"],
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/assinar/retorno?session_id={CHECKOUT_SESSION_ID}`,
    metadata: { user_id: userId },
    subscription_data: { metadata: { user_id: userId } },
  });
  if (!session.client_secret) throw new Error("A Stripe não devolveu client_secret");
  return session.client_secret;
}

export async function createPortalUrl(userId: string): Promise<string> {
  const { data: customer } = await admin().from("stripe_customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (!customer) throw new AppError("not_found", "Nenhuma assinatura encontrada.");
  const portal = await getStripe().billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/conta`,
  });
  return portal.url;
}

function periodEnd(subscription: Stripe.Subscription): Date | null {
  const seconds = subscription.items.data[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000) : null;
}

async function userIdForCustomer(customerId: string): Promise<string | null> {
  const { data } = await admin().from("stripe_customers").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.user_id ?? null;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Grava a assinatura e recalcula o acesso. */
export async function syncSubscription(subscription: Stripe.Subscription) {
  const db = admin();
  const userId = subscription.metadata?.user_id || (await userIdForCustomer(idOf(subscription.customer)!));
  if (!userId) throw new Error(`Assinatura ${subscription.id} sem usuário associado`);

  const end = periodEnd(subscription);
  await db.from("subscriptions").upsert({
    id: subscription.id,
    user_id: userId,
    status: subscription.status,
    price_id: subscription.items.data[0]?.price.id ?? null,
    current_period_end: end?.toISOString() ?? null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });

  const next = entitlementFromSubscription({ status: subscription.status, currentPeriodEnd: end });
  await db
    .from("entitlements")
    .update({
      plan: next.plan,
      access_until: next.accessUntil?.toISOString() ?? null,
      payment_problem: next.paymentProblem,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription);
}

async function recordInvoice(stripe: Stripe, invoice: Stripe.Invoice, status: "paid" | "failed") {
  const db = admin();
  const customerId = idOf(invoice.customer);
  const userId = customerId ? await userIdForCustomer(customerId) : null;
  if (!userId || !invoice.id) return;

  const subscriptionId = invoiceSubscriptionId(invoice);
  let paymentIntentId: string | null = null;
  if (status === "paid") {
    const full = await stripe.invoices.retrieve(invoice.id, { expand: ["payments"] });
    paymentIntentId = idOf(full.payments?.data[0]?.payment?.payment_intent);
  }
  await db.from("payments").upsert({
    id: invoice.id,
    user_id: userId,
    subscription_id: subscriptionId,
    charge_id: paymentIntentId,
    amount: status === "paid" ? invoice.amount_paid : invoice.amount_due,
    currency: invoice.currency,
    status,
    paid_at: status === "paid" ? new Date().toISOString() : null,
  });

  if (status === "paid" && subscriptionId) {
    await db.from("subscriptions").update({ first_paid_at: new Date().toISOString() }).eq("id", subscriptionId).is("first_paid_at", null);
  }
  if (subscriptionId) {
    await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId));
  }
}

async function revokeForPaymentIntent(paymentIntentId: string | null, mark: "refunded" | "disputed") {
  if (!paymentIntentId) return;
  const db = admin();
  const { data: payment } = await db.from("payments").select("id, user_id").eq("charge_id", paymentIntentId).maybeSingle();
  if (!payment) return;
  await db.from("payments").update({ status: mark, refunded_at: new Date().toISOString() }).eq("id", payment.id);
  await db
    .from("entitlements")
    .update({ plan: "free", access_until: null, payment_problem: false, updated_at: new Date().toISOString() })
    .eq("user_id", payment.user_id);
}

/**
 * Processa um evento da Stripe uma única vez. Se algo falhar, a marca é desfeita
 * para que a nova tentativa da Stripe consiga processar de novo.
 */
export async function handleStripeEvent(event: Stripe.Event, injected?: Stripe): Promise<"processed" | "duplicate" | "ignored"> {
  const db = admin();
  const stripe = () => injected ?? getStripe();
  const { error: duplicate } = await db.from("stripe_events").insert({ id: event.id, type: event.type });
  if (duplicate?.code === "23505") return "duplicate";
  if (duplicate) throw duplicate;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const subscriptionId = idOf(session.subscription);
        if (subscriptionId) await syncSubscription(await stripe().subscriptions.retrieve(subscriptionId));
        return "processed";
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        return "processed";
      case "invoice.paid":
        await recordInvoice(stripe(), event.data.object, "paid");
        return "processed";
      case "invoice.payment_failed":
        await recordInvoice(stripe(), event.data.object, "failed");
        return "processed";
      case "charge.refunded": {
        const charge = event.data.object;
        if (charge.refunded) await revokeForPaymentIntent(idOf(charge.payment_intent), "refunded");
        return "processed";
      }
      case "charge.dispute.created":
        await revokeForPaymentIntent(idOf(event.data.object.payment_intent), "disputed");
        return "processed";
      default:
        return "ignored";
    }
  } catch (error) {
    await db.from("stripe_events").delete().eq("id", event.id);
    throw error;
  }
}

/** Direito de arrependimento: cancela na hora e devolve o valor, dentro de 7 dias. */
export async function withdrawSubscription(userId: string, stripe: Stripe = getStripe()) {
  const db = admin();
  const { data: subscription } = await db
    .from("subscriptions")
    .select("id, first_paid_at, status")
    .eq("user_id", userId)
    .not("first_paid_at", "is", null)
    .order("first_paid_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!subscription || !canWithdraw(subscription.first_paid_at)) {
    throw new AppError("closed", "O prazo de 7 dias para arrependimento já terminou.");
  }
  const { data: payment } = await db
    .from("payments")
    .select("id, charge_id")
    .eq("user_id", userId)
    .eq("status", "paid")
    .order("paid_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (payment?.charge_id) {
    await stripe.refunds.create({ payment_intent: payment.charge_id });
  }
  if (subscription.status !== "canceled") await stripe.subscriptions.cancel(subscription.id);
  await db
    .from("entitlements")
    .update({ plan: "free", access_until: null, payment_problem: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}
