import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/ui";
import { countDueReviews } from "@/lib/server/study";
import { isPremium, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Estudar" };

const ICON = {
  treino: "M4 19V9m5 10V5m6 14v-7m5 7V8",
  revisao: "M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15m0 5v-5h5",
  simulados: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
};

function Icon({ path }: { path: string }) {
  return (
    <span className="ico" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
  );
}

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
        <Icon path={ICON.revisao} />
        <div>
          <h2>Revisão</h2>
          <p>{!premium ? "Revise na hora certa o que você errou ou chutou." : pending > 0 ? `Revise ${pending} ${pending === 1 ? "questão que voltou" : "questões que voltaram"} para você.` : "Nada para revisar agora. O que você errar volta aqui."}</p>
        </div>
        {premium ? pending > 0 ? <StatusPill tone="today">{pending} agora</StatusPill> : <StatusPill tone="ok">em dia</StatusPill> : <StatusPill tone="pend">assinatura</StatusPill>}
      </Link>

      <Link href="/app/treino" className={`choice ${premium ? "" : "locked"}`}>
        <Icon path={ICON.treino} />
        <div>
          <h2>Treino</h2>
          <p>Escolha a área e o tamanho da rodada. Treine o que errou ou o que ainda não viu.</p>
        </div>
        {!premium && <StatusPill tone="pend">assinatura</StatusPill>}
      </Link>

      <Link href="/app/simulados" className={`choice ${premium ? "" : "locked"}`}>
        <Icon path={ICON.simulados} />
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
