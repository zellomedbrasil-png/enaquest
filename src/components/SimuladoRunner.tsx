"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { finishSimuladoAction, saveSimuladoAction } from "@/app/actions";
import type { AttemptState } from "@/lib/server/simulados";
import { ExamTables, OptionsList, QuestionHeader } from "./QuestionView";

type Area = { id: string; name: string; color: string };

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SimuladoRunner({ attempt, areas }: { attempt: AttemptState; areas: Area[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>(attempt.answers);
  const [flags, setFlags] = useState<string[]>(attempt.flags);
  const [struck, setStruck] = useState<Record<string, number[]>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [showGrid, setShowGrid] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const latest = useRef({ answers, flags });
  const dirty = useRef(false);
  const finishing = useRef(false);

  const total = attempt.questions.length;
  const question = attempt.questions[index];
  const area = areas.find((a) => a.id === question.areaId);
  const answeredCount = Object.keys(answers).length;
  const unanswered = total - answeredCount;
  const flagged = flags.length;

  const save = useCallback(async () => {
    if (!dirty.current || finishing.current) return;
    dirty.current = false;
    setSaveState("saving");
    const result = await saveSimuladoAction(attempt.attemptId, latest.current);
    if (result.ok) {
      setSaveState("saved");
    } else {
      dirty.current = true;
      setSaveState("error");
    }
  }, [attempt.attemptId]);

  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    start(async () => {
      await finishSimuladoAction(attempt.attemptId, latest.current);
      router.push(`/app/simulados/${attempt.simuladoId}/resultado`);
    });
  }, [attempt.attemptId, attempt.simuladoId, router]);

  // O prazo vem do servidor: fechar a página não para o relógio.
  useEffect(() => {
    const deadline = new Date(attempt.deadline).getTime();
    const tick = () => {
      const left = deadline - Date.now();
      setRemaining(left);
      if (left <= 0) finish();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt.deadline, finish]);

  // Tentativa periódica para cobrir falha de rede, e gravação imediata ao sair da aba.
  useEffect(() => {
    const timer = setInterval(save, 5000);
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [save]);

  // Cada marcação é gravada cerca de 1 segundo depois. "Salvo" só aparece após a confirmação.
  useEffect(() => {
    latest.current = { answers, flags };
    if (!dirty.current) return;
    const timer = setTimeout(save, 900);
    return () => clearTimeout(timer);
  }, [answers, flags, save]);

  const pick = (option: number) => {
    dirty.current = true;
    setSaveState("saving");
    setAnswers((current) => ({ ...current, [question.id]: option }));
  };

  const toggleFlag = () => {
    dirty.current = true;
    setSaveState("saving");
    setFlags((current) => (current.includes(question.id) ? current.filter((id) => id !== question.id) : [...current, question.id]));
  };

  const go = (target: number) => {
    setIndex(Math.max(0, Math.min(total - 1, target)));
    setShowGrid(false);
    window.scrollTo({ top: 0 });
  };

  // Atalhos: A a D marcam, setas mudam de questão.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (confirming || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const position = "abcd".indexOf(event.key.toLowerCase());
      if (position >= 0 && position < question.options.length) pick(position);
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const low = remaining !== null && remaining < 15 * 60 * 1000;
  const isFlagged = flags.includes(question.id);

  const answerSheet = (
    <div className="sim-sheet">
      <div className="sim-sheet-grid">
        {attempt.questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            className={["sim-dot", i === index ? "is-current" : "", typeof answers[q.id] === "number" ? "is-answered" : "", flags.includes(q.id) ? "is-flagged" : ""].join(" ")}
            aria-label={`Questão ${i + 1}${typeof answers[q.id] === "number" ? ", respondida" : ", em branco"}${flags.includes(q.id) ? ", marcada para revisar" : ""}`}
            aria-current={i === index ? "step" : undefined}
            onClick={() => go(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <ul className="sim-legend" aria-hidden>
        <li>
          <i className="is-answered" /> Respondida
        </li>
        <li>
          <i className="is-flagged" /> Revisar depois
        </li>
        <li>
          <i /> Em branco
        </li>
      </ul>
    </div>
  );

  return (
    <div className="sim-exam">
      <header className="sim-bar">
        <div className="sim-bar-title">
          <strong>{attempt.title}</strong>
          <span className="muted" role="status">
            {answeredCount} de {total} marcadas ·{" "}
            <span className={`sim-save is-${saveState}`}>{saveState === "saved" ? "Salvo" : saveState === "saving" ? "Salvando…" : "Sem conexão, tentando de novo"}</span>
          </span>
          <span className="bar level sim-bar-progress" aria-hidden>
            <i style={{ width: `${(answeredCount / total) * 100}%` }} />
          </span>
        </div>
        <div className={`sim-clock ${low ? "is-low" : ""}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span aria-label="Tempo restante">{remaining === null ? "–" : clock(remaining)}</span>
        </div>
        <button type="button" className="btn btn-ghost sim-finish" onClick={() => setConfirming(true)}>
          Entregar prova
        </button>
      </header>

      <div className="sim-layout">
        <article className="card sim-question" aria-label={`Questão ${index + 1} de ${total}`}>
          <div className="sim-question-head">
            <span className="sim-question-num">
              Questão {index + 1} <span className="muted">de {total}</span>
            </span>
            <button type="button" className={`btn btn-ghost btn-sm sim-flag ${isFlagged ? "is-on" : ""}`} aria-pressed={isFlagged} onClick={toggleFlag}>
              {isFlagged ? "★ Marcada para revisar" : "☆ Revisar depois"}
            </button>
          </div>
          <QuestionHeader question={question} areaName={area?.name} areaColor={area?.color} />
          <p className="stem">{question.stem}</p>
          <ExamTables exams={question.exams} />
          <OptionsList
            question={question}
            picked={answers[question.id] ?? null}
            onPick={pick}
            struck={struck[question.id] ?? []}
            onStrike={(i) =>
              setStruck((current) => {
                const list = current[question.id] ?? [];
                return { ...current, [question.id]: list.includes(i) ? list.filter((x) => x !== i) : [...list, i] };
              })
            }
          />
          <div className="simulado-navigation sim-nav">
            <button type="button" className="btn btn-ghost" disabled={index === 0} onClick={() => go(index - 1)}>
              ← Anterior
            </button>
            <button type="button" className="btn btn-ghost sim-grid-toggle" onClick={() => setShowGrid(!showGrid)} aria-expanded={showGrid}>
              Cartão-resposta
            </button>
            <button type="button" className="btn btn-primary" disabled={index === total - 1} onClick={() => go(index + 1)}>
              Próxima →
            </button>
          </div>
          <p className="dim kbd-help">Atalhos: A a D marcam a alternativa; as setas mudam de questão.</p>
          {showGrid && <div className="sim-sheet-mobile">{answerSheet}</div>}
        </article>

        <aside className="card sim-side" aria-label="Cartão-resposta">
          <div className="card-head">
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              Cartão-resposta
            </h2>
            <span className="muted">
              {answeredCount}/{total}
            </span>
          </div>
          {answerSheet}
          <dl className="sim-side-stats">
            <div>
              <dt>Em branco</dt>
              <dd>{unanswered}</dd>
            </div>
            <div>
              <dt>Para revisar</dt>
              <dd>{flagged}</dd>
            </div>
          </dl>
        </aside>
      </div>

      {confirming && (
        <div className="sim-modal" role="dialog" aria-modal="true" aria-labelledby="entregar-titulo">
          <div className="card sim-modal-card">
            <h2 id="entregar-titulo" className="section-title">
              Entregar a prova?
            </h2>
            <p>
              {unanswered > 0 ? `Você deixou ${unanswered} em branco. ` : ""}
              {flagged > 0 ? `${flagged} ${flagged === 1 ? "está marcada" : "estão marcadas"} para revisar. ` : ""}
              Depois de entregar, não dá para voltar. Quer encerrar agora?
            </p>
            <div className="sim-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
                Continuar a prova
              </button>
              <button type="button" className="btn btn-primary" disabled={pending} onClick={finish}>
                {pending ? "Entregando…" : "Entregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
