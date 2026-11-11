"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { selectMascotAction } from "@/app/actions";
import { MASCOTS, type MascotId } from "@/lib/game/mascots";
import type { MascotView } from "@/lib/server/mascot";
import { Mascot } from "./Mascot";

export function MascotPicker({ initial }: { initial: MascotView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(character: MascotId) {
    if (character === view.character || pending) return;
    setError(null);
    setStatus("Salvando sua escolha…");
    start(async () => {
      try {
        const result = await selectMascotAction(character);
        if (!result.ok) {
          setError(result.message);
          setStatus("");
          return;
        }
        setView(result.data);
        setStatus(`${result.data.name} agora acompanha sua jornada.`);
        router.refresh();
      } catch {
        setError("Não foi possível confirmar sua escolha. Tente novamente.");
        setStatus("");
      }
    });
  }

  return (
    <div className="mascot-selection">
      <section className="card mascot-selection-preview" aria-label="Seu companheiro de jornada">
        <span className="eyebrow">Seu companheiro de jornada</span>
        <div className="mascot-selection-stage">
          <Mascot character={view.character} size={210} decorative />
        </div>
        <h2>{view.name}</h2>
        <p className="muted">Ao seu lado em cada questão, revisão e novo aprendizado.</p>
      </section>

      <section className="mascot-selection-options" aria-labelledby="mascot-choice-title" aria-busy={pending}>
        <div>
          <h2 id="mascot-choice-title">Quem vai com você?</h2>
          <p className="muted">Escolha seu companheiro. Você pode trocar quando quiser.</p>
        </div>
        <ul className="mascot-selection-grid" aria-label="Mascotes disponíveis">
          {MASCOTS.map((mascot) => {
            const selected = view.character === mascot.id;
            return (
              <li key={mascot.id}>
                <button
                  type="button"
                  className={`mascot-choice${selected ? " is-selected" : ""}`}
                  aria-label={`Escolher ${mascot.name}`}
                  aria-pressed={selected}
                  disabled={pending}
                  onClick={() => choose(mascot.id)}
                >
                  <span className="mascot-choice-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                  <Mascot character={mascot.id} size={104} decorative />
                  <strong>{mascot.name}</strong>
                  <span className="mascot-choice-label">{selected ? "Seu companheiro" : "Escolher"}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="muted" role="status" aria-live="polite">{status}</p>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
