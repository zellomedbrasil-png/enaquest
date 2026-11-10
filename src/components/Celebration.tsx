"use client";

import { useEffect, useRef, useState } from "react";
import { Confetti } from "./Confetti";
import { Emblem } from "./Emblem";
import { MyMascot } from "./MyMascot";

export type CelebrationItem =
  | { kind: "tier"; name: string; rating: number }
  | { kind: "level"; name: string };

/** Tela cheia para subida de patente e de nível. Mostra um item por vez. */
export function Celebration({ items, onClose }: { items: CelebrationItem[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const item = items[index];
  const last = index >= items.length - 1;

  const advance = () => (last ? onClose() : setIndex((i) => i + 1));
  const button = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Foco preso no diálogo e devolvido a quem estava focado antes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    button.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        event.preventDefault();
        button.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, []);

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
          <div className="celebrate-emblem">
            <MyMascot mood="comemorando" size={132} background />
          </div>
        )}
        <h2 id="celebrate-title" style={{ fontSize: 34, margin: "8px 0 4px" }}>
          {item.name}
        </h2>
        <p className="muted">{item.kind === "tier" ? "Seu rating passou para a próxima faixa." : "Seu XP chegou ao próximo nível."}</p>
        <button type="button" className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} onClick={advance} ref={button}>
          {last ? "Continuar" : "Próxima"}
        </button>
      </div>
    </div>
  );
}
