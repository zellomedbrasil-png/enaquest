"use client";

import { useState, useTransition } from "react";
import { startTrainingAction } from "@/app/actions";
import type { PublicQuestion } from "@/lib/server/questions";
import { QuestionRunner } from "./QuestionRunner";

type Area = { id: string; name: string; color: string; published: number; pct?: number | null; n?: number; priority?: boolean };
type Filter = "novas" | "erradas" | "todas";

const FILTERS: { value: Filter; title: string; text: string }[] = [
  { value: "novas", title: "Ainda não vistas", text: "Só questões que você nunca respondeu." },
  { value: "erradas", title: "Que errei", text: "Refaça o que errou até virar acerto." },
  { value: "todas", title: "Todas", text: "Mistura novas e já respondidas." },
];
const SIZES = [5, 10, 20, 30];
/** Cerca de um minuto e meio por questão, como na prova. */
const minutesFor = (size: number) => Math.round(size * 1.5);

export function TrainingClient({ areas, initialAreaId = null }: { areas: Area[]; initialAreaId?: string | null }) {
  const [areaId, setAreaId] = useState<string | null>(initialAreaId);
  const [filter, setFilter] = useState<Filter>("novas");
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

  const area = areas.find((item) => item.id === areaId) ?? null;
  const filterInfo = FILTERS.find((item) => item.value === filter)!;

  return (
    <div className="cols-main train-builder">
      <div className="card train-steps">
        <fieldset className="train-step">
          <legend>
            <span className="train-step-num">1</span> Escolha a área
          </legend>
          <div className="train-areas">
            <button type="button" className="train-area is-exam" aria-pressed={areaId === null} onClick={() => setAreaId(null)}>
              <strong>Como na prova</strong>
              <span>Todas as áreas, no peso do ENARE</span>
            </button>
            {areas.map((item) => (
              <button
                key={item.id}
                type="button"
                className="train-area"
                style={{ borderTopColor: item.color }}
                aria-pressed={areaId === item.id}
                onClick={() => setAreaId(item.id)}
              >
                <strong>
                  <i className="area-dot" style={{ background: item.color }} /> {item.name}
                </strong>
                <span>
                  {item.pct !== null && item.pct !== undefined ? `${item.pct}% de acerto` : item.n ? `${item.n} ${item.n === 1 ? "respondida" : "respondidas"}` : "Ainda sem respostas"}
                </span>
                {item.priority && <span className="pill pill-priority train-area-tag">Prioridade</span>}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="train-step">
          <legend>
            <span className="train-step-num">2</span> Quais questões
          </legend>
          <div className="train-filters">
            {FILTERS.map((item) => (
              <button key={item.value} type="button" className="train-filter" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="train-step">
          <legend>
            <span className="train-step-num">3</span> Tamanho da rodada
          </legend>
          <div className="train-sizes">
            {SIZES.map((value) => (
              <button key={value} type="button" className="train-size" aria-pressed={size === value} onClick={() => setSize(value)}>
                {value}
              </button>
            ))}
          </div>
          <p className="dim train-size-hint">Cerca de {minutesFor(size)} minutos.</p>
        </fieldset>
      </div>

      <aside className="aside">
        <section className="card train-summary" aria-labelledby="resumo-treino">
          <p className="eyebrow">Seu treino</p>
          <h2 id="resumo-treino" className="section-title" style={{ marginBottom: 0 }}>
            {size} questões
          </h2>
          <dl>
            <div>
              <dt>Área</dt>
              <dd>
                {area ? (
                  <>
                    <i className="area-dot" style={{ background: area.color }} /> {area.name}
                  </>
                ) : (
                  "Como na prova"
                )}
              </dd>
            </div>
            <div>
              <dt>Questões</dt>
              <dd>{filterInfo.title}</dd>
            </div>
            <div>
              <dt>Tempo estimado</dt>
              <dd>≈ {minutesFor(size)} min</dd>
            </div>
          </dl>
          <button type="button" className="btn btn-primary" style={{ width: "100%" }} disabled={pending} onClick={begin}>
            {pending ? "Preparando…" : "Começar treino"}
          </button>
          {message && (
            <div className="alert alert-info" role="status">
              {message}
            </div>
          )}
          <p className="dim" style={{ fontSize: 12.5, margin: 0 }}>
            O que você errar ou marcar com dúvida volta na Revisão.
          </p>
        </section>
      </aside>
    </div>
  );
}
