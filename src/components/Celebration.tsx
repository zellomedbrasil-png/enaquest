"use client";

import { useEffect, useState } from "react";
import { Confetti } from "./Confetti";
import { Emblem } from "./Emblem";

export type CelebrationItem =
  | { kind: "tier"; name: string; rating: number }
  | { kind: "level"; name: string };

/** Tela cheia para subida de patente e de nível. Mostra um item por vez. */
export function Celebration({ items, onClose }: { items: CelebrationItem[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const item = items[index];
  const last = index >= items.length - 1;

  const advance = () => (last ? onClose() : setIndex((i) => i + 1));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!item) return null;

  return (
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title">
      <Confetti key={index} />
      <div className="celebrate-card">
        <p className="eyebrow">{item.kind === "tier" ? "Nova patente" : "Novo nível"}</p>
        {item.kind === "tier" ? (
          <div className="celebrate-emblem">
            <Emblem rating={item.rating} size={104} />
          </div>
        ) : (
          <div className="celebrate-level display" aria-hidden>
            ★
          </div>
        )}
        <h2 id="celebrate-title" style={{ fontSize: 34, margin: "8px 0 4px" }}>
          {item.name}
        </h2>
        <p className="muted">{item.kind === "tier" ? "Seu rating passou para a próxima faixa." : "Seu XP chegou ao próximo nível."}</p>
        <button type="button" className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} onClick={advance} autoFocus>
          {last ? "Continuar" : "Próxima"}
        </button>
      </div>
    </div>
  );
}
