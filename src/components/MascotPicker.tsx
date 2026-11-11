"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import { selectMascotAction } from "@/app/actions";
import { MASCOTS, resolveMascot, type MascotId } from "@/lib/game/mascots";
import type { MascotView } from "@/lib/server/mascot";
import { Mascot } from "./Mascot";

export type PlantonistaStats = { level: string; xp: number; streak: number; patente: string };

/**
 * Aba Mascote: palco com o companheiro, a ficha de plantão do aluno e o elenco.
 * Passar o mouse (ou o foco) num personagem mostra a prévia no palco; tocar escolhe.
 */
export function MascotPicker({ initial, stats }: { initial: MascotView; stats: PlantonistaStats }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [preview, setPreview] = useState<MascotId | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = resolveMascot(preview ?? view.character);
  const previewing = shown.id !== view.character;

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
    <div className="mascot-lab" style={{ "--accent-mascot": shown.accent } as CSSProperties}>
      <section className="card mascot-stage" aria-label="Seu parceiro de plantão">
        <p className={`mascot-stage-tag${previewing ? " is-preview" : ""}`}>
          {previewing ? "Prévia · toque para escolher" : "Seu parceiro de plantão"}
        </p>

        <div className="mascot-stage-scene">
          <span className="mascot-stage-glow" aria-hidden />
          <span className="mascot-stage-floor" aria-hidden />
          <span key={shown.id} className="mascot-stage-figure">
            <Mascot character={shown.id} size={200} decorative />
          </span>
        </div>

        <div className="mascot-stage-id">
          <h2>{shown.name}</h2>
          <p className="mascot-stage-tagline">{shown.tagline}</p>
          <ul className="mascot-traits" aria-label="Traços">
            {shown.traits.map((trait) => (
              <li key={trait}>{trait}</li>
            ))}
          </ul>
        </div>

        <blockquote key={`q-${shown.id}`} className="mascot-quote">
          “{shown.quote}”
        </blockquote>

        <div className="mascot-sheet" aria-label="Sua ficha de plantão">
          <p className="eyebrow">Sua ficha de plantão</p>
          <dl>
            <div>
              <dt>Nível</dt>
              <dd>{stats.level}</dd>
            </div>
            <div>
              <dt>XP</dt>
              <dd>{stats.xp}</dd>
            </div>
            <div>
              <dt>Sequência</dt>
              <dd>
                {stats.streak} {stats.streak === 1 ? "dia" : "dias"}
              </dd>
            </div>
            <div>
              <dt>Patente</dt>
              <dd>{stats.patente}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mascot-roster" aria-labelledby="mascot-choice-title" aria-busy={pending}>
        <div className="mascot-roster-head">
          <h2 id="mascot-choice-title">Escolha quem vai com você</h2>
          <p className="muted">Cada companheiro tem seu jeito de estudar. Troque quando quiser.</p>
        </div>
        <ul className="mascot-roster-grid" aria-label="Mascotes disponíveis" onMouseLeave={() => setPreview(null)}>
          {MASCOTS.map((mascot) => {
            const selected = view.character === mascot.id;
            return (
              <li key={mascot.id}>
                <button
                  type="button"
                  className={`mascot-card-pick${selected ? " is-selected" : ""}`}
                  style={{ "--accent-mascot": mascot.accent } as CSSProperties}
                  aria-label={`Escolher ${mascot.name}`}
                  aria-pressed={selected}
                  disabled={pending}
                  onMouseEnter={() => setPreview(mascot.id)}
                  onFocus={() => setPreview(mascot.id)}
                  onBlur={() => setPreview(null)}
                  onClick={() => choose(mascot.id)}
                >
                  {selected && (
                    <span className="mascot-card-badge" aria-hidden="true">
                      Com você
                    </span>
                  )}
                  <span className="mascot-card-portrait" aria-hidden="true">
                    <Mascot character={mascot.id} size={84} decorative />
                  </span>
                  <strong>{mascot.name}</strong>
                  <span className="mascot-card-tagline">{mascot.tagline}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="muted" role="status" aria-live="polite">
          {status}
        </p>
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
