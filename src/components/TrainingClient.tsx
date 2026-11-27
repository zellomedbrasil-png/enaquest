"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { countTrainingAction, startTrainingAction } from "@/app/actions";
import type { PublicQuestion } from "@/lib/server/questions";
import type { TrainingCatalog } from "@/lib/server/study";
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty, type TrainingSource, type TrainingStatus } from "@/lib/study/training-filter";
import { QuestionRunner } from "./QuestionRunner";

type Area = { id: string; name: string; color: string; published: number; pct?: number | null; n?: number; priority?: boolean };

const STATUS_OPTIONS: { value: TrainingStatus; title: string; text: string }[] = [
  { value: "novas", title: "Ainda não vistas", text: "Só questões que você nunca respondeu." },
  { value: "erradas", title: "Que errei", text: "Refaça o que errou até virar acerto." },
  { value: "inseguras", title: "Acertei sem certeza", text: "Acertos no chute ou na dúvida." },
  { value: "marcadas", title: "Marcadas para rever", text: "As que você marcou durante o estudo." },
  { value: "todas", title: "Todas", text: "Mistura novas e já respondidas." },
];
const SIZES = [5, 10, 20, 30];
/** Cerca de um minuto e meio por questão, como na prova. */
const minutesFor = (size: number) => Math.round(size * 1.5);

const EMPTY_MESSAGE: Record<TrainingStatus, string> = {
  novas: "Você já respondeu todas as questões com esses filtros.",
  erradas: "Nenhuma questão errada com esses filtros. Bom sinal!",
  inseguras: "Nenhum acerto no chute ou na dúvida com esses filtros.",
  marcadas: "Nenhuma questão marcada com esses filtros.",
  todas: "Nenhuma questão com esses filtros.",
};

export function TrainingClient({
  areas,
  catalog,
  premium = true,
  initialAreaId = null,
}: {
  areas: Area[];
  catalog: TrainingCatalog;
  premium?: boolean;
  initialAreaId?: string | null;
}) {
  const [areaId, setAreaId] = useState<string | null>(initialAreaId);
  const [theme, setTheme] = useState<string | null>(null);
  const [source, setSource] = useState<TrainingSource>("todas");
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [withImages, setWithImages] = useState(false);
  const [status, setStatus] = useState<TrainingStatus>("novas");
  const [size, setSize] = useState(10);
  const [available, setAvailable] = useState<number | null>(null);
  const [round, setRound] = useState<{ context: string; questions: PublicQuestion[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filters = { areaId, theme, source, difficulties, withImages, filter: status, size };
  const filterKey = JSON.stringify({ areaId, theme, source, difficulties, withImages, status });

  // Conta as questões disponíveis a cada mudança de filtro, com uma pausa curta para não disparar a cada clique.
  useEffect(() => {
    let cancelled = false;
    const current = JSON.parse(filterKey);
    const timer = setTimeout(async () => {
      const result = await countTrainingAction({
        areaId: current.areaId,
        theme: current.theme,
        source: current.source,
        difficulties: current.difficulties,
        withImages: current.withImages,
        filter: current.status,
        size: 10,
      });
      if (!cancelled) setAvailable(result.ok ? result.data : null);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filterKey]);

  const pickArea = (id: string | null) => {
    setAreaId(id);
    setTheme(null);
  };
  const toggleDifficulty = (value: Difficulty) =>
    setDifficulties((current) => (current.includes(value) ? current.filter((d) => d !== value) : [...current, value]));

  const begin = () =>
    start(async () => {
      setMessage(null);
      const result = await startTrainingAction(filters);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      if (!result.data.questions.length) {
        setMessage(EMPTY_MESSAGE[status]);
        return;
      }
      setRound(result.data);
    });

  if (round) {
    return <QuestionRunner key={round.context} questions={round.questions} mode="training" context={round.context} areas={areas} doneHref="/app/treino" doneLabel="Novo treino" onDone={() => undefined} />;
  }

  const area = areas.find((item) => item.id === areaId) ?? null;
  const themes = areaId ? (catalog.themes[areaId] ?? []) : [];
  const statusInfo = STATUS_OPTIONS.find((item) => item.value === status)!;
  const sourceLabel =
    source === "todas" ? "Todas" : source === "autorais" ? "Questões EnaQuest" : (catalog.exams.find((e) => `prova:${e.id}` === source)?.name ?? "Prova oficial");
  const roundSize = available === null ? size : Math.min(size, available);

  return (
    <div className="cols-main train-builder">
      <div className="card train-steps">
        <fieldset className="train-step">
          <legend>
            <span className="train-step-num">1</span> Área e tema
          </legend>
          <div className="train-areas">
            <button type="button" className="train-area is-exam" aria-pressed={areaId === null} onClick={() => pickArea(null)}>
              <strong>Como na prova</strong>
              <span>Todas as áreas, no peso da prova</span>
            </button>
            {areas.map((item) => (
              <button
                key={item.id}
                type="button"
                className="train-area"
                style={{ borderTopColor: item.color }}
                aria-pressed={areaId === item.id}
                onClick={() => pickArea(item.id)}
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
          {areaId && themes.length > 0 && (
            <div>
              <label className="label" htmlFor="train-theme">
                Tema
              </label>
              <select id="train-theme" className="select" value={theme ?? ""} onChange={(event) => setTheme(event.target.value || null)}>
                <option value="">Todos os temas de {area?.name}</option>
                {themes.map((item) => (
                  <option key={item.theme} value={item.theme}>
                    {item.theme} ({item.count})
                  </option>
                ))}
              </select>
            </div>
          )}
        </fieldset>

        <fieldset className="train-step">
          <legend>
            <span className="train-step-num">2</span> De onde vêm as questões
          </legend>
          <div className="train-chips">
            <button type="button" className="train-chip" aria-pressed={source === "todas"} onClick={() => setSource("todas")}>
              Todas
            </button>
            <button type="button" className="train-chip" aria-pressed={source === "autorais"} onClick={() => setSource("autorais")}>
              Questões EnaQuest <small>{catalog.authored}</small>
            </button>
            {catalog.exams.map((exam) => (
              <button key={exam.id} type="button" className="train-chip" aria-pressed={source === `prova:${exam.id}`} onClick={() => setSource(`prova:${exam.id}`)}>
                {exam.name} <small>{exam.count}</small>
              </button>
            ))}
          </div>
          {catalog.exams.length === 0 && <p className="dim train-size-hint">As provas oficiais aparecem aqui assim que forem publicadas.</p>}
        </fieldset>

        <fieldset className="train-step">
          <legend>
            <span className="train-step-num">3</span> Quais questões
          </legend>
          <div className="train-filters">
            {STATUS_OPTIONS.map((item) => (
              <button key={item.value} type="button" className="train-filter" aria-pressed={status === item.value} onClick={() => setStatus(item.value)}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="train-step">
          <legend>
            <span className="train-step-num">4</span> Dificuldade
          </legend>
          <div className="train-chips">
            <button type="button" className="train-chip" aria-pressed={difficulties.length === 0} onClick={() => setDifficulties([])}>
              Qualquer
            </button>
            {DIFFICULTIES.map((value) => (
              <button key={value} type="button" className="train-chip" aria-pressed={difficulties.includes(value)} onClick={() => toggleDifficulty(value)}>
                {DIFFICULTY_LABEL[value]}
              </button>
            ))}
          </div>
          {catalog.withImages > 0 && (
            <label className="train-toggle">
              <input type="checkbox" checked={withImages} onChange={(event) => setWithImages(event.target.checked)} /> Só questões com imagem (ECG, exame, foto)
            </label>
          )}
        </fieldset>

        <fieldset className="train-step">
          <legend>
            <span className="train-step-num">5</span> Tamanho da rodada
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
            {roundSize} {roundSize === 1 ? "questão" : "questões"}
          </h2>
          <p className="muted" style={{ fontSize: 14, margin: 0 }} aria-live="polite">
            {available === null ? "Contando questões…" : available === 0 ? "Nenhuma questão com esses filtros." : `${available} ${available === 1 ? "questão disponível" : "questões disponíveis"} com esses filtros.`}
          </p>
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
            {theme && (
              <div>
                <dt>Tema</dt>
                <dd>{theme}</dd>
              </div>
            )}
            <div>
              <dt>Origem</dt>
              <dd>{sourceLabel}</dd>
            </div>
            <div>
              <dt>Questões</dt>
              <dd>{statusInfo.title}</dd>
            </div>
            {difficulties.length > 0 && (
              <div>
                <dt>Dificuldade</dt>
                <dd>{difficulties.map((d) => DIFFICULTY_LABEL[d]).join(", ")}</dd>
              </div>
            )}
            <div>
              <dt>Tempo estimado</dt>
              <dd>≈ {minutesFor(roundSize)} min</dd>
            </div>
          </dl>
          {premium ? (
            <button type="button" className="btn btn-primary" style={{ width: "100%" }} disabled={pending || available === 0} onClick={begin}>
              {pending ? "Preparando…" : "Começar treino"}
            </button>
          ) : (
            <>
              <Link href="/planos" className="btn btn-primary" style={{ width: "100%" }}>
                Liberar o Treino
              </Link>
              <p className="dim" style={{ fontSize: 12.5, margin: 0 }}>
                O Treino faz parte da assinatura. O Plantão do Dia continua grátis.
              </p>
            </>
          )}
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
