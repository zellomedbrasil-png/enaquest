"use client";

import Image from "next/image";
import { type CSSProperties, useState } from "react";
import { MASCOTS } from "@/lib/game/mascots";
import s from "./landing.module.css";

export function CompanionShowcase() {
  const [index, select] = useState(0);
  const companion = MASCOTS[index];

  return (
    <section className={s.console} aria-label="Escolha um companheiro para conhecer">
      <div className={s.consoleTop}><span><i /> Seleção de personagem</span><b aria-hidden="true">•••</b></div>
      <div className={s.scene}>
        <div className={s.stars} aria-hidden="true" />
        <div className={s.moon} aria-hidden="true" />
        <div className={s.city} aria-hidden="true">{[29,55,42,78,54,32,67,48,86,48,69,35].map((height, i) => <i key={i} style={{height: height + "%"}} />)}</div>
        <div className={s.platform} aria-hidden="true" />
        <Image src={companion.image} width={480} height={720} sizes="180px" alt="" priority={index === 0} className={s.character} />
        <button type="button" className={s.prev} aria-label="Companheiro anterior" onClick={() => select((index + MASCOTS.length - 1) % MASCOTS.length)}>‹</button>
        <button type="button" className={s.next} aria-label="Próximo companheiro" onClick={() => select((index + 1) % MASCOTS.length)}>›</button>
      </div>
      <div className={s.profile} aria-live="polite" aria-atomic="true" style={{ "--profile-accent": companion.accent } as CSSProperties}>
        <div className={s.consoleBase}>
          <div><small>Companheiro de jornada</small><strong>{companion.name}</strong><p>{companion.tagline}</p></div>
          <span aria-label={`Personagem ${index + 1} de ${MASCOTS.length}`}>{String(index + 1).padStart(2, "0")} / {String(MASCOTS.length).padStart(2, "0")}</span>
        </div>
        <ul className={s.traits} aria-label="Traços do companheiro">
          {companion.traits.map(trait => <li key={trait}>{trait}</li>)}
        </ul>
        <blockquote>“{companion.quote}”</blockquote>
      </div>
    </section>
  );
}
