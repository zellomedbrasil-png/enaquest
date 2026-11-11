"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { emptySeen, markSeen, readSeen, subscribeSeen } from "@/lib/ui/coach";
import { MyMascot } from "./MyMascot";

const ID = "tutorial-home";

/** Convite para o "Como funciona" nos primeiros dias. Some quando a pessoa toca em "Agora não". */
export function TutorialBanner() {
  const seen = useSyncExternalStore(subscribeSeen, readSeen, emptySeen);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  if (!hydrated || seen.has(ID)) return null;
  return (
    <aside className="tutorial-banner" aria-label="Aprenda a usar o EnaQuest">
      <MyMascot size={56} />
      <div>
        <strong>Aprenda a usar o EnaQuest em 2 minutos</strong>
        <p>Veja como funcionam o Plantão, o XP, a sequência e a Revisão.</p>
      </div>
      <div className="tutorial-banner-actions">
        <Link href="/app/como-funciona" className="btn btn-dark btn-sm">
          Ver tutorial
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => markSeen(ID)}>
          Agora não
        </button>
      </div>
    </aside>
  );
}
