"use client";

import type { ExamTable, PublicQuestion } from "@/lib/server/questions";
import { LETTERS } from "@/lib/ui/labels";

export function ExamTables({ exams }: { exams: ExamTable[] | null }) {
  if (!exams?.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      {exams.map((table) => (
        <div key={table.title} style={{ overflowX: "auto" }}>
          <div className="eyebrow" style={{ marginTop: 8 }}>
            {table.title}
          </div>
          <table className="exam-table">
            <thead>
              <tr>
                <th scope="col">Exame</th>
                <th scope="col">Resultado</th>
                <th scope="col">Referência</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row[0]}>
                  <td>{row[0]}</td>
                  <td style={{ fontWeight: 700 }}>{row[1]}</td>
                  <td className="muted">{row[2] ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function QuestionHeader({ question, areaName, areaColor }: { question: PublicQuestion; areaName?: string; areaColor?: string }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
      {areaName && (
        <span className="pill">
          <i className="area-dot" style={{ background: areaColor }} /> {areaName}
        </span>
      )}
      <span className="pill">{question.scenario}</span>
      <span className="pill">{question.difficultyLabel}</span>
    </div>
  );
}

export function OptionsList({
  question,
  picked,
  onPick,
  struck,
  onStrike,
  locked,
  correctIndex,
}: {
  question: PublicQuestion;
  picked: number | null;
  onPick?: (index: number) => void;
  struck?: number[];
  onStrike?: (index: number) => void;
  locked?: boolean;
  correctIndex?: number | null;
}) {
  return (
    <div role="radiogroup" aria-label="Alternativas" style={{ marginTop: 14 }}>
      {question.options.map((text, index) => {
        const isPicked = picked === index;
        const revealed = typeof correctIndex === "number";
        const classes = ["opt"];
        if (revealed && index === correctIndex) classes.push("correct");
        else if (revealed && isPicked) classes.push("wrong");
        else if (isPicked) classes.push("selected");
        if (struck?.includes(index) && !revealed) classes.push("struck");
        return (
          <div key={index} className={classes.join(" ")}>
            <button
              type="button"
              role="radio"
              aria-checked={isPicked}
              disabled={locked}
              onClick={() => onPick?.(index)}
              className="opt-main"
            >
              <span className="letter" aria-hidden>
                {LETTERS[index]}
              </span>
              <span className="opt-text">
                <span className="sr-only">Alternativa {LETTERS[index]}: </span>
                {text}
                {revealed && index === correctIndex && <strong style={{ color: "var(--ok)" }}> · Correta</strong>}
                {revealed && isPicked && index !== correctIndex && <strong style={{ color: "var(--bad)" }}> · Sua resposta</strong>}
              </span>
            </button>
            {onStrike && !locked ? (
              <button
                type="button"
                className="strike-btn"
                aria-label={`Riscar alternativa ${LETTERS[index]}`}
                aria-pressed={struck?.includes(index)}
                onClick={() => onStrike(index)}
              >
                ✕
              </button>
            ) : (
              <span />
            )}
          </div>
        );
      })}
    </div>
  );
}
