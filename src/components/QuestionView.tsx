"use client";

import { useRef, useState } from "react";
import type { ExamTable, PublicQuestion } from "@/lib/server/questions";
import { segments, toggleRange, type Range } from "@/lib/ui/highlight";
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
    <div className="q-tags">
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

/** Grifos por questão, guardados só enquanto a página está aberta. */
export function useHighlights() {
  const [byQuestion, setByQuestion] = useState<Record<string, Range[]>>({});
  return {
    get: (id: string) => byQuestion[id] ?? [],
    toggle: (id: string, range: Range) => setByQuestion((all) => ({ ...all, [id]: toggleRange(all[id] ?? [], range) })),
    clear: (id: string) => setByQuestion((all) => ({ ...all, [id]: [] })),
  };
}

function offsetIn(container: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(node, offset);
  return range.toString().length;
}

/** Enunciado com grifos. Com o marca-texto ligado, selecionar um trecho grifa ou apaga o grifo. */
export function Stem({ text, ranges = [], highlighting = false, onHighlight }: { text: string; ranges?: Range[]; highlighting?: boolean; onHighlight?: (range: Range) => void }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const finish = () => {
    if (!highlighting || !onHighlight || !ref.current) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!ref.current.contains(range.startContainer) || !ref.current.contains(range.endContainer)) return;
    onHighlight([offsetIn(ref.current, range.startContainer, range.startOffset), offsetIn(ref.current, range.endContainer, range.endOffset)]);
    selection.removeAllRanges();
  };
  return (
    <p ref={ref} className={`stem ${highlighting ? "is-highlighting" : ""}`} onMouseUp={finish} onTouchEnd={finish} onKeyUp={(e) => e.shiftKey && finish()}>
      {segments(text, ranges).map((part, i) => (part.marked ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
    </p>
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
  comments,
  optionPct,
}: {
  question: PublicQuestion;
  picked: number | null;
  onPick?: (index: number) => void;
  struck?: number[];
  onStrike?: (index: number) => void;
  locked?: boolean;
  correctIndex?: number | null;
  /** Depois do gabarito: comentário embaixo de cada alternativa. */
  comments?: Record<number, string>;
  optionPct?: number[];
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
        else if (revealed) classes.push("faded");
        if (struck?.includes(index) && !revealed) classes.push("struck");
        const comment = revealed ? comments?.[index] : undefined;
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
            {comment && (
              <details className="opt-comment" open={index === correctIndex || isPicked}>
                <summary>
                  Ver comentário
                  {optionPct && optionPct.length > 0 && <span className="dim"> · {optionPct[index] ?? 0}% marcaram</span>}
                </summary>
                <p>
                  <strong className={index === correctIndex ? "is-ok" : "is-bad"}>{index === correctIndex ? "CORRETA." : "INCORRETA."}</strong> {comment}
                </p>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
