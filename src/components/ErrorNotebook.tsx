"use client";

import Link from "next/link";
import { useState } from "react";
import { ERROR_REASON_LABEL, formatDate } from "@/lib/ui/labels";

export type NotebookCard = {
  questionId: string;
  slug: string;
  theme: string;
  areaName: string;
  areaColor: string;
  reason: string | null;
  when: string;
  due: string | null;
  /** Já voltou para revisão (calculado no servidor). */
  ready: boolean;
};

const NO_REASON = "sem-motivo";

/** Caderno de erros com filtro por motivo: ajuda a ver o padrão do que está errando. */
export function ErrorNotebook({ entries }: { entries: NotebookCard[] }) {
  const [filter, setFilter] = useState<string>("todos");

  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.reason ?? NO_REASON;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const chips = [
    { key: "todos", label: "Todos", count: entries.length },
    ...Object.keys(ERROR_REASON_LABEL)
      .filter((reason) => counts.has(reason))
      .map((reason) => ({ key: reason, label: ERROR_REASON_LABEL[reason], count: counts.get(reason) ?? 0 })),
    ...(counts.has(NO_REASON) ? [{ key: NO_REASON, label: "Sem motivo", count: counts.get(NO_REASON) ?? 0 }] : []),
  ];
  const shown = filter === "todos" ? entries : entries.filter((entry) => (entry.reason ?? NO_REASON) === filter);

  return (
    <>
      <div className="notebook-filters" role="group" aria-label="Filtrar por motivo do erro">
        {chips.map((chip) => (
          <button key={chip.key} type="button" className="notebook-chip" aria-pressed={filter === chip.key} onClick={() => setFilter(chip.key)}>
            {chip.label}
            <span>{chip.count}</span>
          </button>
        ))}
      </div>

      <ul className="notebook-grid">
        {shown.map((entry) => (
          <li key={entry.questionId}>
            <Link href={`/app/questao/${entry.slug}`} className="notebook-card" style={{ borderLeftColor: entry.areaColor }}>
              <span className="notebook-area">
                <i className="area-dot" style={{ background: entry.areaColor }} /> {entry.areaName}
              </span>
              <strong className="notebook-theme">{entry.theme}</strong>
              <span className="notebook-meta">
                <span className={`notebook-reason ${entry.reason ? "" : "is-empty"}`}>{entry.reason ? ERROR_REASON_LABEL[entry.reason] : "Motivo não marcado"}</span>
                <span className="dim">Errou em {formatDate(entry.when)}</span>
              </span>
              <span className={`notebook-due ${entry.ready ? "is-ready" : ""}`}>
                {entry.ready ? "Pronta para revisar" : entry.due ? `Volta em ${formatDate(entry.due)}` : "Fora da revisão"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
