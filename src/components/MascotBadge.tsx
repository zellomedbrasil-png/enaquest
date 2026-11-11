"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MascotId } from "@/lib/game/mascots";
import { levelOf } from "@/lib/game/xp";
import { Mascot } from "./Mascot";
import { PROGRESS_EVENT, type ProgressEventDetail } from "./TopStats";

/** Mini-avatar do mascote no topo: mesmo personagem do Posto de Plantão, com o nível atual. */
export function MascotBadge({ character, name, xpTotal }: { character: MascotId; name: string; xpTotal: number }) {
  const [xp, setXp] = useState(xpTotal);

  useEffect(() => {
    const onProgress = (event: Event) => setXp((event as CustomEvent<ProgressEventDetail>).detail.xpTotal);
    window.addEventListener(PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(PROGRESS_EVENT, onProgress);
  }, []);

  const level = levelOf(xp).current.name;
  return (
    <Link href="/app/mascote" className="mascot-badge" aria-label={`${name}, nível ${level}. Em plantão com você`}>
      <span className="mascot-badge-face" aria-hidden="true">
        <Mascot character={character} size={48} decorative />
      </span>
      <span className="mascot-badge-text" aria-hidden="true">
        <strong>
          {name} ({level})
        </strong>
        <span>Em plantão com você</span>
      </span>
    </Link>
  );
}
