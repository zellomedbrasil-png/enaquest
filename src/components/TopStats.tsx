"use client";

import { useEffect, useRef, useState } from "react";
import { levelOf } from "@/lib/game/xp";
import { MAX_SHIELDS } from "@/lib/game/streak";
import { Flame, ShieldDots } from "./Flame";

/** Evento disparado pelo QuestionRunner a cada resposta para o topo atualizar sem recarregar. */
export const PROGRESS_EVENT = "enaquest:progress";
export type ProgressEventDetail = { xpTotal: number; streak: number; shields: number };

/** Número que sobe até o valor novo em vez de trocar de uma vez. */
function useCountUp(target: number): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      from.current = target;
      const id = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(id);
    }
    const begin = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - begin) / 700);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(start + (target - start) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = target;
    };
  }, [target]);
  return shown;
}

export function TopStats({
  xpTotal,
  streak,
  shields,
  activeToday,
}: {
  xpTotal: number;
  streak: number;
  shields: number;
  activeToday: boolean;
}) {
  const [state, setState] = useState({ xpTotal, streak, shields, activeToday });
  const [gain, setGain] = useState(0);

  // O servidor renderiza de novo ao navegar; o valor novo dele manda.
  useEffect(() => {
    const id = requestAnimationFrame(() => setState({ xpTotal, streak, shields, activeToday }));
    return () => cancelAnimationFrame(id);
  }, [xpTotal, streak, shields, activeToday]);

  const latestXp = useRef(xpTotal);
  useEffect(() => {
    latestXp.current = state.xpTotal;
  }, [state.xpTotal]);

  useEffect(() => {
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<ProgressEventDetail>).detail;
      if (detail.xpTotal > latestXp.current) setGain((n) => n + 1);
      setState({ xpTotal: detail.xpTotal, streak: detail.streak, shields: detail.shields, activeToday: true });
    };
    window.addEventListener(PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(PROGRESS_EVENT, onProgress);
  }, []);

  const level = levelOf(state.xpTotal);
  const xpShown = useCountUp(state.xpTotal);
  const lit = state.activeToday && state.streak > 0;

  return (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
          <strong>{level.current.name}</strong>
          <span key={gain} className={gain ? "muted xp-float" : "muted"} style={{ fontVariantNumeric: "tabular-nums" }}>
            {xpShown} XP
          </span>
        </div>
        <div className="bar level" style={{ height: 7, marginTop: 3 }} role="progressbar" aria-label="Progresso até o próximo nível" aria-valuenow={Math.round(level.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${level.progress * 100}%` }} />
        </div>
      </div>
      <span
        key={`streak-${state.streak}`}
        className={`streak-badge ${lit ? "lit" : ""}`}
        title={lit ? "Dias seguidos de estudo" : "Responda uma questão hoje para manter a sequência"}
        aria-label={`${state.streak} dias seguidos${lit ? "" : ", ainda sem estudo hoje"}. ${state.shields} de ${MAX_SHIELDS} trocas de plantão`}
      >
        <Flame lit={lit} size={16} />
        <b aria-hidden>{state.streak}</b>
        <ShieldDots count={state.shields} max={MAX_SHIELDS} />
      </span>
    </>
  );
}
