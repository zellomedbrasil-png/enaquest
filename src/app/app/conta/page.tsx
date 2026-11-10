import type { Metadata } from "next";
import Link from "next/link";
import { deleteAccountAction, portalAction, signOut } from "@/app/actions";
import { FeedbackSettings } from "@/components/FeedbackSettings";
import { ReadingSettings } from "@/components/ReadingSettings";
import { ProfileForm, WithdrawButton } from "@/components/ProfileForms";
import { PageHeader } from "@/components/ui";
import { canWithdraw, hasPremiumAccess } from "@/lib/billing/access";
import { admin } from "@/lib/supabase/admin";
import { getEntitlement, getProfile, requireUser } from "@/lib/server/session";
import { formatDate } from "@/lib/ui/labels";

export const metadata: Metadata = { title: "Conta" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const params = await searchParams;
  const user = await requireUser();
  const db = admin();
  const [profile, entitlement, { data: schools }, { data: subscription }] = await Promise.all([
    getProfile(user.id),
    getEntitlement(user.id),
    db.from("schools").select("id, name, uf").eq("active", true).order("name"),
    db.from("subscriptions").select("status, current_period_end, cancel_at_period_end, first_paid_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const premium = hasPremiumAccess(entitlement);
  const live = subscription && ["active", "trialing", "past_due"].includes(subscription.status);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <PageHeader title="Sua conta" lead="Ajuste seu perfil, a leitura e a assinatura." />

      <section className="card">
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Perfil</h2>
        <ProfileForm nickname={profile.nickname} schoolId={profile.school_id} showSchool={profile.show_school} schools={schools ?? []} />
      </section>

      <section className="card">
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Leitura</h2>
        <ReadingSettings />
      </section>

      <section className="card">
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Sons e vibração</h2>
        <FeedbackSettings />
      </section>

      <section className="card">
        <h2 style={{ fontSize: 18, marginBottom: 6 }}>Assinatura</h2>
        {premium && entitlement?.access_until ? (
          <p className="muted" style={{ marginBottom: 10 }}>
            {live && !subscription.cancel_at_period_end
              ? `Ativa. Próxima cobrança perto de ${formatDate(subscription.current_period_end)}.`
              : `Acesso até ${formatDate(entitlement.access_until)}. A assinatura não será renovada.`}
          </p>
        ) : (
          <p className="muted" style={{ marginBottom: 10 }}>
            Você está no plano grátis.
          </p>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          {live ? (
            <form action={portalAction}>
              <button className="btn btn-ghost">Gerenciar assinatura e cartão</button>
            </form>
          ) : (
            <Link href="/assinar" className="btn btn-primary">
              Assinar por R$ 29 por mês
            </Link>
          )}
          {subscription && premium && canWithdraw(subscription.first_paid_at) && <WithdrawButton />}
        </div>
      </section>

      <section className="card">
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Sair e excluir</h2>
        <form action={signOut} style={{ marginBottom: 14 }}>
          <button className="btn btn-ghost">Sair da conta</button>
        </form>
        <details>
          <summary style={{ cursor: "pointer", color: "var(--bad)", fontWeight: 600 }}>Excluir minha conta</summary>
          <form action={deleteAccountAction} style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <p className="muted" style={{ fontSize: 14.5 }}>
              Isso apaga para sempre seu perfil, respostas, pontos e comentários, e não pode ser desfeito. Se tiver assinatura ativa, cancele antes.
            </p>
            <label className="label" htmlFor="confirm">
              Digite EXCLUIR para confirmar
            </label>
            <input id="confirm" name="confirm" className="input" autoComplete="off" required />
            {params.erro === "confirmacao" && (
              <div className="alert alert-error" role="alert">
                Digite EXCLUIR exatamente assim.
              </div>
            )}
            <button className="btn btn-danger">Excluir para sempre</button>
          </form>
        </details>
      </section>
    </div>
  );
}
