import type { Metadata } from "next";
import Link from "next/link";
import { PremiumGate } from "@/components/PremiumGate";
import { listSimulados } from "@/lib/server/simulados";
import { isPremium, requireUser } from "@/lib/server/session";
import { formatDateTime } from "@/lib/ui/labels";

export const metadata: Metadata = { title: "Simulados" };

export default async function SimuladosPage() {
  const user = await requireUser();
  if (!(await isPremium(user.id))) {
    return <PremiumGate title="Teste sua resistência" text="100 questões, 4 alternativas e 5 horas, como na prova, com percentil nacional e por faculdade." />;
  }
  const simulados = await listSimulados(user.id);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 26 }}>Simulados</h1>
      {simulados.length === 0 && (
        <div className="card">
          <p className="muted">O primeiro Simulado Nacional será anunciado aqui. Ele usa a proporção por área medida na prova real.</p>
        </div>
      )}
      {simulados.map((simulado) => {
        const open = simulado.isOpen;
        const finished = Boolean(simulado.attempt?.finishedAt);
        const started = Boolean(simulado.attempt) && !finished;
        return (
          <section key={simulado.id} className="card">
            <h2 style={{ fontSize: 20 }}>{simulado.title}</h2>
            <p className="muted" style={{ fontSize: 14, margin: "4px 0 10px" }}>
              {simulado.questionCount} questões · {Math.round(simulado.durationMinutes / 60)} horas · aberto de {formatDateTime(simulado.opensAt)} até {formatDateTime(simulado.closesAt)}
            </p>
            {finished && (
              <Link href={`/app/simulados/${simulado.id}/resultado`} className="btn btn-primary">
                Ver resultado: {simulado.attempt?.correct}/{simulado.attempt?.total}
              </Link>
            )}
            {started && (
              <Link href={`/app/simulados/${simulado.id}`} className="btn btn-primary">
                Continuar
              </Link>
            )}
            {!simulado.attempt && open && (
              <Link href={`/app/simulados/${simulado.id}`} className="btn btn-primary">
                Começar
              </Link>
            )}
            {!simulado.attempt && !open && <span className="pill">Fora da janela de aplicação</span>}
          </section>
        );
      })}
    </div>
  );
}
