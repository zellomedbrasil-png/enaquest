import type { Metadata } from "next";
import Link from "next/link";
import { getStripe, stripeConfigured } from "@/lib/billing/stripe";
import { syncSubscription } from "@/lib/billing/subscriptions";
import { admin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/server/session";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Assinatura" };

export default async function CheckoutReturnPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams;
  const user = await requireUser();

  let paid = false;
  if (sessionId && stripeConfigured()) {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const { data: mine } = await admin().from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    // A sessão precisa ser desta pessoa. O webhook é a fonte oficial; aqui só adiantamos a liberação.
    if (mine?.stripe_customer_id === customerId && session.status === "complete" && session.subscription) {
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId));
      paid = true;
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="wrap-wide" style={{ maxWidth: 560, paddingTop: 30, textAlign: "center" }}>
        <div className="card">
          {paid ? (
            <>
              <h1 style={{ fontSize: 28 }}>Assinatura ativa</h1>
              <p className="muted" style={{ margin: "8px 0 14px" }}>
                Treino, revisão, simulados e Termômetro já estão liberados.
              </p>
              <Link href="/app" className="btn btn-primary">
                Ir para o app
              </Link>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 28 }}>Pagamento não concluído</h1>
              <p className="muted" style={{ margin: "8px 0 14px" }}>
                Nada foi cobrado por esta tentativa. Se o cartão foi recusado, confira se é de crédito Visa ou Mastercard.
              </p>
              <Link href="/assinar" className="btn btn-primary">
                Tentar de novo
              </Link>
            </>
          )}
        </div>
      </main>
    </>
  );
}
