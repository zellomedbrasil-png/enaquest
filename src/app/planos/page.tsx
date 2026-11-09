import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Planos" };

const FREE = ["Plantão do Dia com 10 questões", "Comentário completo dessas questões", "Discussão da turma", "XP, patentes, sequência e ligas"];
const PREMIUM = [
  "Tudo do plano grátis",
  "Treino ilimitado por área",
  "Revisão espaçada e caderno de erros",
  "Simulados completos com percentil",
  "Termômetro de Proficiência",
];

export default function PlansPage() {
  return (
    <>
      <SiteHeader />
      <main className="wrap-wide" style={{ paddingTop: 20 }}>
        <h1 style={{ fontSize: 36 }}>Um plano simples</h1>
        <p className="muted" style={{ margin: "6px 0 20px" }}>
          Comece de graça e assine só se fizer sentido para você.
        </p>
        <div className="grid-2">
          <section className="card">
            <h2 style={{ fontSize: 20 }}>Grátis</h2>
            <p className="display" style={{ fontSize: 34, margin: "6px 0" }}>
              R$ 0
            </p>
            <ul style={{ display: "grid", gap: 6, margin: "12px 0 16px" }}>
              {FREE.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
            <Link href="/cadastrar" className="btn btn-ghost" style={{ width: "100%" }}>
              Criar conta grátis
            </Link>
          </section>
          <section className="card" style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
            <h2 style={{ fontSize: 20 }}>Assinatura</h2>
            <p className="display" style={{ fontSize: 34, margin: "6px 0" }}>
              R$ 29<span style={{ fontSize: 16, fontWeight: 600 }}> por mês</span>
            </p>
            <ul style={{ display: "grid", gap: 6, margin: "12px 0 16px" }}>
              {PREMIUM.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
            <Link href="/assinar" className="btn btn-primary" style={{ width: "100%" }}>
              Assinar
            </Link>
            <p className="muted" style={{ fontSize: 13.5, marginTop: 10 }}>
              Cancele quando quiser. Até 7 dias depois do primeiro pagamento, você pode desistir e receber o valor de volta.
            </p>
          </section>
        </div>

        <div className="alert alert-info" style={{ marginTop: 14 }}>
          <strong>Formas de pagamento:</strong> cartão de crédito Visa ou Mastercard, Google Pay e Apple Pay. Por enquanto, não aceitamos cartão de
          débito, Pix, Elo, Hipercard nem American Express.
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
