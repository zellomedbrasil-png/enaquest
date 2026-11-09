"use client";

import { useState, useTransition } from "react";
import { startTrainingAction } from "@/app/actions";
import type { PublicQuestion } from "@/lib/server/questions";
import { QuestionRunner } from "./QuestionRunner";

type Area = { id: string; name: string; color: string; published: number };

export function TrainingClient({ areas }: { areas: Area[] }) {
  const [areaId, setAreaId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"novas" | "erradas" | "todas">("novas");
  const [size, setSize] = useState(10);
  const [round, setRound] = useState<{ context: string; questions: PublicQuestion[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const begin = () =>
    start(async () => {
      setMessage(null);
      const result = await startTrainingAction({ areaId, filter, size });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      if (!result.data.questions.length) {
        setMessage(filter === "erradas" ? "Nenhuma questão errada aqui. Bom sinal!" : "Você já respondeu todas as questões desse filtro.");
        return;
      }
      setRound(result.data);
    });

  if (round) {
    return <QuestionRunner key={round.context} questions={round.questions} mode="training" context={round.context} areas={areas} doneHref="/app/treino" doneLabel="Novo treino" onDone={() => undefined} />;
  }

  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <fieldset>
        <legend className="label">Área</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button type="button" className="btn btn-ghost btn-sm" aria-pressed={areaId === null} style={areaId === null ? { borderColor: "var(--accent)", background: "var(--tip-soft)" } : undefined} onClick={() => setAreaId(null)}>
            Como na prova
          </button>
          {areas.map((area) => (
            <button
              key={area.id}
              type="button"
              className="btn btn-ghost btn-sm"
              aria-pressed={areaId === area.id}
              style={areaId === area.id ? { borderColor: "var(--accent)", background: "var(--tip-soft)" } : undefined}
              onClick={() => setAreaId(area.id)}
            >
              <i className="area-dot" style={{ background: area.color }} /> {area.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Questões</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(
            [
              ["novas", "Ainda não vistas"],
              ["erradas", "Que errei"],
              ["todas", "Todas"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="btn btn-ghost btn-sm"
              aria-pressed={filter === value}
              style={filter === value ? { borderColor: "var(--accent)", background: "var(--tip-soft)" } : undefined}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Tamanho da rodada</legend>
        <div style={{ display: "flex", gap: 6 }}>
          {[5, 10, 20, 30].map((value) => (
            <button
              key={value}
              type="button"
              className="btn btn-ghost btn-sm"
              aria-pressed={size === value}
              style={size === value ? { borderColor: "var(--accent)", background: "var(--tip-soft)" } : undefined}
              onClick={() => setSize(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="button" className="btn btn-primary" disabled={pending} onClick={begin}>
        {pending ? "Preparando…" : "Começar treino"}
      </button>
      {message && (
        <div className="alert alert-info" role="status">
          {message}
        </div>
      )}
    </div>
  );
}
