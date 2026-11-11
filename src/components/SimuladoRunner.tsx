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

  const question = attempt.questions[index];
  const area = areas.find((a) => a.id === question.areaId);
  const answeredCount = Object.keys(answers).length;
  const unanswered = attempt.questions.length - answeredCount;

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
    setIndex(Math.max(0, Math.min(attempt.questions.length - 1, target)));
    setShowGrid(false);
    window.scrollTo({ top: 0 });
  };

  const low = remaining !== null && remaining < 15 * 60 * 1000;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div className="display" style={{ fontSize: 18 }}>
            {attempt.title}
          </div>
          <div className="muted" style={{ fontSize: 13 }} role="status">
            {answeredCount} de {attempt.questions.length} marcadas ·{" "}
            {saveState === "saved" ? "Salvo" : saveState === "saving" ? "Salvando…" : "Sem conexão, tentando de novo"}
          </div>
        </div>
        <div
          className="display"
          aria-label="Tempo restante"
          style={{ fontSize: 24, fontVariantNumeric: "tabular-nums", color: low ? "var(--bad)" : "var(--ink)" }}
        >
          {remaining === null ? "–" : clock(remaining)}
        </div>
      </div>

      <article className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <strong>Questão {index + 1}</strong>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-pressed={flags.includes(question.id)}
            style={flags.includes(question.id) ? { borderColor: "var(--gold)" } : undefined}
            onClick={toggleFlag}
          >
            {flags.includes(question.id) ? "Marcada para revisar" : "Revisar depois"}
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
        <div className="simulado-navigation" style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" disabled={index === 0} onClick={() => go(index - 1)}>
            Anterior
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setShowGrid(!showGrid)} aria-expanded={showGrid}>
            Cartão-resposta
          </button>
          <button type="button" className="btn btn-primary" disabled={index === attempt.questions.length - 1} onClick={() => go(index + 1)}>
            Próxima
          </button>
        </div>
      </article>

      {showGrid && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="dots">
            {attempt.questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                className={["dot", i === index ? "current" : "", typeof answers[q.id] === "number" ? "answered" : "", flags.includes(q.id) ? "flagged" : ""].join(" ")}
                aria-label={`Questão ${i + 1}${typeof answers[q.id] === "number" ? ", respondida" : ", em branco"}${flags.includes(q.id) ? ", marcada para revisar" : ""}`}
                onClick={() => go(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, textAlign: "center" }}>
        {!confirming ? (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)}>
            Entregar prova
          </button>
        ) : (
          <div className="card">
            <p style={{ marginBottom: 10 }}>
              {unanswered > 0 ? `Você deixou ${unanswered} em branco. ` : ""}Depois de entregar, não dá para voltar. Quer encerrar agora?
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
                Continuar a prova
              </button>
              <button type="button" className="btn btn-primary" disabled={pending} onClick={finish}>
                {pending ? "Entregando…" : "Entregar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
