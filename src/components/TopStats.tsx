"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { levelOf } from "@/lib/game/xp";
import { MAX_SHIELDS } from "@/lib/game/streak";
import { Flame, ShieldDots } from "./Flame";

/** Evento disparado pelo QuestionRunner a cada resposta para o topo atualizar sem recarregar. */
export const PROGRESS_EVENT = "enaquest:progress";
export type ProgressEventDetail = { xpTotal: number; streak: number; shields: number; dailyDone?: number };

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

/**
 * Painel de bordo do topo: nível e XP à esquerda; à direita, o andamento do Plantão do Dia,
 * as revisões que voltaram e a sequência. Cada pastilha leva direto para a ferramenta.
 */
export function TopStats({
  xpTotal,
  streak,
  shields,
  activeToday,
  dailyDone,
  dailyTotal,
  dueReviews,
  premium,
}: {
  xpTotal: number;
  streak: number;
  shields: number;
  activeToday: boolean;
  dailyDone: number;
  dailyTotal: number;
  dueReviews: number;
  premium: boolean;
}) {
  const [state, setState] = useState({ xpTotal, streak, shields, activeToday, dailyDone });
  const [gain, setGain] = useState(0);

  // O servidor renderiza de novo ao navegar; o valor novo dele manda.
  useEffect(() => {
    const id = requestAnimationFrame(() => setState({ xpTotal, streak, shields, activeToday, dailyDone }));
    return () => cancelAnimationFrame(id);
  }, [xpTotal, streak, shields, activeToday, dailyDone]);

  const latestXp = useRef(xpTotal);
  useEffect(() => {
    latestXp.current = state.xpTotal;
  }, [state.xpTotal]);

  useEffect(() => {
    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<ProgressEventDetail>).detail;
      if (detail.xpTotal > latestXp.current) setGain((n) => n + 1);
      setState((current) => ({
        xpTotal: detail.xpTotal,
        streak: detail.streak,
        shields: detail.shields,
        activeToday: true,
        dailyDone: detail.dailyDone ?? current.dailyDone,
      }));
    };
    window.addEventListener(PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(PROGRESS_EVENT, onProgress);
  }, []);

  const level = levelOf(state.xpTotal);
  const xpShown = useCountUp(state.xpTotal);
  const lit = state.activeToday && state.streak > 0;
  const plantaoDone = dailyTotal > 0 && state.dailyDone >= dailyTotal;
  const plantaoRatio = dailyTotal > 0 ? Math.min(1, state.dailyDone / dailyTotal) : 0;

  return (
    <>
      <div className="hud-level" title={level.next ? `Faltam ${level.toNext} XP para ${level.next.name}` : "Nível máximo"}>
        <div className="hud-level-top">
          <strong>{level.current.name}</strong>
          <span key={gain} className={gain ? "hud-xp xp-float" : "hud-xp"}>
            {xpShown}
            {level.next ? ` / ${level.next.min}` : ""} XP
          </span>
        </div>
        <div
          className="bar level"
          style={{ height: 7 }}
          role="progressbar"
          aria-label="Progresso até o próximo nível"
          aria-valuenow={Math.round(level.progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${level.progress * 100}%` }} />
        </div>
        <p className="hud-level-next">{level.next ? `Faltam ${level.toNext} XP para ${level.next.name}` : "Nível máximo"}</p>
      </div>

      <div className="hud-chips">
        {dailyTotal > 0 && (
          <Link
            href="/app/plantao"
            className={`hud-chip hud-plantao ${plantaoDone ? "is-done" : ""}`}
            style={{ "--p": `${plantaoRatio * 360}deg` } as CSSProperties}
            aria-label={plantaoDone ? "Plantão do Dia concluído. Rever as questões" : `Plantão do Dia: ${state.dailyDone} de ${dailyTotal}. Continuar`}
          >
            <span className="hud-ring" aria-hidden>
              {plantaoDone ? "✓" : ""}
            </span>
            <span aria-hidden>{plantaoDone ? "Plantão feito" : `Plantão ${state.dailyDone}/${dailyTotal}`}</span>
          </Link>
        )}
        {premium && dueReviews > 0 && (
          <Link href="/app/revisao" className="hud-chip hud-reviews" aria-label={`${dueReviews} ${dueReviews === 1 ? "revisão voltou" : "revisões voltaram"}. Revisar`}>
            <i className="hud-dot" aria-hidden />
            <span aria-hidden>
              {dueReviews} {dueReviews === 1 ? "revisão" : "revisões"}
            </span>
          </Link>
        )}
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
      </div>
    </>
  );
}
