import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutClient } from "@/components/CheckoutClient";
import { SiteHeader } from "@/components/SiteHeader";
import { stripeConfigured } from "@/lib/billing/stripe";
import { hasPremiumAccess } from "@/lib/billing/access";
import { admin } from "@/lib/supabase/admin";
import { getEntitlement, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Assinar" };

export default async function SubscribePage() {
  const user = await requireUser();
  const entitlement = await getEntitlement(user.id);
  const { data: live } = await admin().from("subscriptions").select("id").eq("user_id", user.id).in("status", ["active", "trialing", "past_due"]).limit(1);
  if (live?.length && hasPremiumAccess(entitlement)) redirect("/app/conta");

  return (
    <>
      <SiteHeader />
      <main className="wrap-wide" style={{ maxWidth: 640, paddingTop: 12, paddingBottom: 60 }}>
        <h1 style={{ fontSize: 30 }}>Assinatura EnaQuest</h1>
        <p className="muted" style={{ margin: "6px 0 14px" }}>
          R$ 29 por mês, com renovação automática. Cancele quando quiser. Até 7 dias depois do primeiro pagamento, você pode desistir e receber o valor de volta.
        </p>
        <div className="alert alert-info" style={{ marginBottom: 14 }}>
          <strong>Antes de continuar:</strong> aceitamos cartão de crédito Visa ou Mastercard, Google Pay e Apple Pay. Por enquanto, cartão de débito, Pix, Elo, Hipercard e American Express não funcionam.
        </div>
        {stripeConfigured() ? (
          <CheckoutClient publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!} />
        ) : (
          <div className="alert alert-error" role="alert">
            O pagamento ainda não foi configurado neste ambiente.
          </div>
        )}
        <p className="dim" style={{ fontSize: 13.5, marginTop: 14 }}>
          Ao assinar, você aceita os <Link href="/termos">termos de uso</Link>. O pagamento é processado pela Stripe: os dados do cartão não passam pelos nossos servidores.
        </p>
      </main>
    </>
  );
}
