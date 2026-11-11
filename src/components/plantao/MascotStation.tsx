"use client";

import type { Mood } from "../Mascot";
import { MyMascot, useMyMascot } from "../MyMascot";
import type { MascotView } from "./useMascotState";

const MOOD_BY_TONE: Record<MascotView["badge"]["tone"], Mood> = {
  neutral: "neutro",
  info: "neutro",
  hint: "neutro",
  success: "feliz",
  warning: "preocupado",
};

/**
 * Posto de Plantão: o mascote dentro do card da questão.
 * "full" fica na base da coluna do enunciado (desktop); "compact" é a barra horizontal do celular.
 */
export function MascotStation({
  view,
  onRequestHint,
  variant = "full",
  className = "",
}: {
  view: MascotView;
  onRequestHint: () => void;
  variant?: "full" | "compact";
  className?: string;
}) {
  const { name } = useMyMascot();
  const { badge, line, lineKey, celebrate, answered } = view;
  const compact = variant === "compact";

  return (
    <section
      className={`mascot-station is-${badge.tone} ${compact ? "is-compact" : ""} ${className}`}
      aria-label={`${name}, parceiro de plantão`}
    >
      <div className={`mascot-station-avatar ${celebrate ? "is-celebrating" : ""}`} aria-hidden="true">
        <span className="mascot-station-figure">
          <MyMascot size={compact ? 56 : 80} mood={MOOD_BY_TONE[badge.tone]} />
        </span>
      </div>

      <div className="mascot-station-body">
        <div className="mascot-station-head">
          <strong>{name}</strong>
          <span className="mascot-station-badge">{badge.label}</span>
        </div>

        <p key={lineKey} className="mascot-station-bubble" role="status" aria-live="polite" aria-atomic="true">
          {line}
        </p>

        {!answered && (
          <button type="button" className="mascot-station-hint" onClick={onRequestHint}>
            <span aria-hidden="true" className="mascot-station-hint-icon">?</span>
            Pedir pista clínica
          </button>
        )}
      </div>
    </section>
  );
}
