"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { emptySeen, markSeen, readSeen, subscribeSeen } from "@/lib/ui/coach";

/** Dica curta que aparece só na primeira vez e some quando a pessoa toca em "Entendi". */
export function Coach({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const seen = useSyncExternalStore(subscribeSeen, readSeen, emptySeen);
  // No servidor e na primeira pintura a lista vem vazia; só mostramos depois de ler o aparelho.
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  if (!hydrated || seen.has(id)) return null;
  return (
    <aside className="coach" aria-label="Dica">
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => markSeen(id)}>
        Entendi
      </button>
    </aside>
  );
}
