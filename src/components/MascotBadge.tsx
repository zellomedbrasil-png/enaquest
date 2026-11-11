import Link from "next/link";
import type { MascotId } from "@/lib/game/mascots";
import { Mascot } from "./Mascot";

/** Mini-avatar do companheiro no topo: leva à escolha do mascote. O nível já aparece no painel ao lado. */
export function MascotBadge({ character, name }: { character: MascotId; name: string }) {
  return (
    <Link href="/app/mascote" className="mascot-badge" aria-label={`${name}, seu companheiro de plantão. Trocar de mascote`}>
      <span className="mascot-badge-face" aria-hidden="true">
        <Mascot character={character} size={48} decorative />
      </span>
      <span className="mascot-badge-text" aria-hidden="true">
        <strong>{name}</strong>
        <span>Em plantão com você</span>
      </span>
    </Link>
  );
}
