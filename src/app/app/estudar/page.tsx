import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, StatusPill, ToolIcon } from "@/components/ui";
import { countDueReviews } from "@/lib/server/study";
import { isPremium, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Estudar" };

export default async function StudyPage() {
  const user = await requireUser();
  const [premium, due] = await Promise.all([
    isPremium(user.id),
    countDueReviews(user.id),
  ]);
  const pending = due;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <PageHeader title="Estudar" lead="Escolha como estudar agora. O Plantão do Dia fica na tela Hoje e é sempre grátis." />

      <div className="grid-3 choice-grid">
      <Link href="/app/revisao" className={`choice ${premium ? "" : "locked"}`}>
        <ToolIcon name="revisao" />
        <div>
          <h2>Revisão</h2>
          <p>{!premium ? "Revise na hora certa o que você errou ou chutou." : pending > 0 ? `Revise ${pending} ${pending === 1 ? "questão que voltou" : "questões que voltaram"} para você.` : "Nada para revisar agora. O que você errar volta aqui."}</p>
        </div>
        {premium ? pending > 0 ? <StatusPill tone="today">{pending} agora</StatusPill> : <StatusPill tone="ok">em dia</StatusPill> : <StatusPill tone="pend">assinatura</StatusPill>}
      </Link>

      <Link href="/app/treino" className={`choice ${premium ? "" : "locked"}`}>
        <ToolIcon name="treino" />
        <div>
          <h2>Treino</h2>
          <p>Escolha a área e o tamanho da rodada. Treine o que errou ou o que ainda não viu.</p>
        </div>
        {!premium && <StatusPill tone="pend">assinatura</StatusPill>}
      </Link>

      <Link href="/app/simulados" className={`choice ${premium ? "" : "locked"}`}>
        <ToolIcon name="simulados" />
        <div>
          <h2>Simulados</h2>
          <p>Faça uma prova completa com tempo, como no dia, e compare seu resultado com a turma.</p>
        </div>
        {!premium && <StatusPill tone="pend">assinatura</StatusPill>}
      </Link>

      </div>

      {!premium && (
        <p className="muted" style={{ fontSize: 14.5 }}>
          Revisão, Treino e Simulados fazem parte da assinatura.{" "}
          <Link href="/planos">Ver o que está incluso</Link>.
        </p>
      )}
    </div>
  );
}
