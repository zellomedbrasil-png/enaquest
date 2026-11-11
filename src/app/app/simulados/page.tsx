import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { PremiumGate } from "@/components/PremiumGate";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader, ToolIcon } from "@/components/ui";
import { listSimulados, type SimuladoSummary } from "@/lib/server/simulados";
import { isPremium, requireUser } from "@/lib/server/session";
import { formatDateTime } from "@/lib/ui/labels";

export const metadata: Metadata = { title: "Simulados" };

type Status = "andamento" | "aberto" | "concluido" | "encerrado";

function statusOf(simulado: SimuladoSummary): Status {
  if (simulado.attempt?.finishedAt) return "concluido";
  if (simulado.attempt) return "andamento";
  return simulado.isOpen ? "aberto" : "encerrado";
}

const STATUS_LABEL: Record<Status, string> = {
  andamento: "Em andamento",
  aberto: "Aberto agora",
  concluido: "Concluído",
  encerrado: "Encerrado",
};

function hours(minutes: number) {
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} ${h === 1 ? "hora" : "horas"}`;
}

function SimuladoCard({ simulado }: { simulado: SimuladoSummary }) {
  const status = statusOf(simulado);
  const score = status === "concluido" && simulado.attempt?.total ? Math.round(((simulado.attempt.correct ?? 0) / simulado.attempt.total) * 100) : null;
  return (
    <li className={`sim-card is-${status}`}>
      <div className="sim-card-main">
        <span className={`sim-status is-${status}`}>{STATUS_LABEL[status]}</span>
        <h3>{simulado.title}</h3>
        <ul className="sim-meta">
          <li>{simulado.questionCount} questões</li>
          <li>{hours(simulado.durationMinutes)}</li>
          <li>
            {formatDateTime(simulado.opensAt)} até {formatDateTime(simulado.closesAt)}
          </li>
        </ul>
      </div>
      <div className="sim-card-side">
        {score !== null && (
          <span className="sim-score" style={{ "--p": `${score * 3.6}deg` } as CSSProperties}>
            <span>{score}%</span>
          </span>
        )}
        {status === "concluido" && (
          <Link href={`/app/simulados/${simulado.id}/resultado`} className="btn btn-ghost">
            Ver resultado: {simulado.attempt?.correct}/{simulado.attempt?.total}
          </Link>
        )}
        {status === "andamento" && (
          <Link href={`/app/simulados/${simulado.id}`} className="btn btn-primary">
            Continuar
          </Link>
        )}
        {status === "aberto" && (
          <Link href={`/app/simulados/${simulado.id}`} className="btn btn-primary">
            Começar
          </Link>
        )}
      </div>
    </li>
  );
}

export default async function SimuladosPage() {
  const user = await requireUser();
  if (!(await isPremium(user.id))) {
    return <PremiumGate title="Teste sua resistência" text="100 questões, 4 alternativas e 5 horas, como na prova, com percentil nacional e por faculdade." />;
  }
  const simulados = await listSimulados(user.id);

  const groups: Record<Status, SimuladoSummary[]> = { andamento: [], aberto: [], concluido: [], encerrado: [] };
  for (const simulado of simulados) groups[statusOf(simulado)].push(simulado);

  const done = groups.concluido.filter((s) => s.attempt?.total);
  const pcts = done.map((s) => ((s.attempt!.correct ?? 0) / s.attempt!.total!) * 100);
  const best = pcts.length ? Math.round(Math.max(...pcts)) : null;
  const average = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
  const active = [...groups.andamento, ...groups.aberto];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader title="Simulados" lead="Faça uma prova completa com tempo, como no dia, e compare seu resultado com a turma." />

      <section className="card sim-hero" aria-label="Como funcionam os simulados">
        <div className="sim-hero-text">
          <span className="sim-hero-icon">
            <ToolIcon name="simulados" />
          </span>
          <div>
            <h2>Treine a resistência do dia da prova</h2>
            <p className="muted">Relógio correndo, sem gabarito até entregar e progresso salvo a cada marcação. No fim, você vê sua posição e o desempenho por área.</p>
          </div>
        </div>
        <dl className="sim-hero-stats">
          <div>
            <dt>Feitos</dt>
            <dd>{done.length}</dd>
          </div>
          <div>
            <dt>Melhor</dt>
            <dd>{best === null ? "–" : `${best}%`}</dd>
          </div>
          <div>
            <dt>Média</dt>
            <dd>{average === null ? "–" : `${average}%`}</dd>
          </div>
        </dl>
      </section>

      {simulados.length === 0 && (
        <EmptyState title="Nenhum simulado aberto agora">
          O primeiro Simulado Nacional será anunciado aqui. Ele usa a proporção por área medida na prova real. Enquanto isso, faça o Plantão do Dia.
        </EmptyState>
      )}

      {active.length > 0 && (
        <section aria-labelledby="sim-abertos" style={{ display: "grid", gap: 10 }}>
          <h2 id="sim-abertos" className="section-title" style={{ marginBottom: 0 }}>
            Para fazer agora
          </h2>
          <ul className="sim-list">
            {active.map((simulado) => (
              <SimuladoCard key={simulado.id} simulado={simulado} />
            ))}
          </ul>
        </section>
      )}

      {groups.concluido.length > 0 && (
        <section aria-labelledby="sim-feitos" style={{ display: "grid", gap: 10 }}>
          <h2 id="sim-feitos" className="section-title" style={{ marginBottom: 0 }}>
            Seus resultados
          </h2>
          <ul className="sim-list">
            {groups.concluido.map((simulado) => (
              <SimuladoCard key={simulado.id} simulado={simulado} />
            ))}
          </ul>
        </section>
      )}

      {groups.encerrado.length > 0 && (
        <details className="sim-closed">
          <summary>
            Encerrados sem participação <span>{groups.encerrado.length}</span>
          </summary>
          <ul className="sim-list">
            {groups.encerrado.map((simulado) => (
              <SimuladoCard key={simulado.id} simulado={simulado} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
