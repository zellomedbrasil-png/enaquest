"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveStudyGoalsAction } from "@/app/actions";
import { DAILY_MINUTES_OPTIONS } from "@/lib/study/day-plan";

type Goals = { minutes: number; targetExam: "enamed" | "enare"; examDate: string | null };

const EXAMS: { value: Goals["targetExam"]; label: string }[] = [
  { value: "enamed", label: "ENAMED" },
  { value: "enare", label: "ENARE" },
];

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1).replace(".", ",")} h`;
}

/** Metas do Seu dia: tempo por dia, prova e data. `compact` mostra só o resumo até a pessoa tocar em Ajustar. */
export function StudyGoalsForm({ initial, compact = false, today }: { initial: Goals; compact?: boolean; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(!compact);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [targetExam, setTargetExam] = useState(initial.targetExam);
  const [examDate, setExamDate] = useState(initial.examDate ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setMessage(null);
      const result = await saveStudyGoalsAction({ minutes, targetExam, examDate: examDate || null });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.message });
        return;
      }
      setMessage({ tone: "ok", text: "Seu dia foi ajustado." });
      if (compact) setOpen(false);
      router.refresh();
    });

  if (!open) {
    return (
      <div className="goals-summary">
        <span>
          <strong>{minutesLabel(initial.minutes)}</strong> por dia · {initial.targetExam === "enare" ? "ENARE" : "ENAMED"}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          Ajustar
        </button>
      </div>
    );
  }

  const options = DAILY_MINUTES_OPTIONS.includes(minutes as (typeof DAILY_MINUTES_OPTIONS)[number]) ? DAILY_MINUTES_OPTIONS : [...DAILY_MINUTES_OPTIONS, minutes].sort((a, b) => a - b);

  return (
    <div className="goals-form">
      <fieldset>
        <legend className="label">Quanto tempo você tem por dia?</legend>
        <div className="goals-options">
          {options.map((value) => (
            <button key={value} type="button" className="btn btn-ghost btn-sm" aria-pressed={minutes === value} onClick={() => setMinutes(value)}>
              {minutesLabel(value)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Qual prova?</legend>
        <div className="goals-options">
          {EXAMS.map((exam) => (
            <button key={exam.value} type="button" className="btn btn-ghost btn-sm" aria-pressed={targetExam === exam.value} onClick={() => setTargetExam(exam.value)}>
              {exam.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="goals-exam-date">
          Data da prova (opcional)
        </label>
        <input id="goals-exam-date" className="input" type="date" min={today} value={examDate} onChange={(event) => setExamDate(event.target.value)} />
        <p className="dim" style={{ fontSize: 13.5, marginTop: 4 }}>
          Se o edital ainda não saiu, deixe em branco. Com a data, a reta final ganha simulados.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "Salvando..." : "Montar meu dia"}
        </button>
        {compact && (
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </button>
        )}
      </div>
      {message && (
        <p className={message.tone === "ok" ? "alert alert-ok" : "alert alert-error"} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
