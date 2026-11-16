"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToolIcon } from "./ui";
import { useEffect, useRef, useState } from "react";
import { levelOf } from "@/lib/game/xp";
import { MAX_SHIELDS } from "@/lib/game/streak";
import { Flame, ShieldDots } from "./Flame";

/** Evento disparado pelo QuestionRunner a cada resposta para o topo atualizar sem recarregar. */
export const PROGRESS_EVENT = "enaquest:progress";
export type ProgressEventDetail = { xpTotal: number; streak: number; shields: number; dailyDone?: number; reviewAnswered?: boolean };

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
  const pathname = usePathname();
  const [state, setState] = useState({ xpTotal, streak, shields, activeToday, dailyDone, dueReviews });
  const [gain, setGain] = useState(0);

  // O servidor renderiza de novo ao navegar; o valor novo dele manda.
  useEffect(() => {
    const id = requestAnimationFrame(() => setState({ xpTotal, streak, shields, activeToday, dailyDone, dueReviews }));
    return () => cancelAnimationFrame(id);
  }, [xpTotal, streak, shields, activeToday, dailyDone, dueReviews]);

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
        dueReviews: Math.max(0, current.dueReviews - (detail.reviewAnswered ? 1 : 0)),
      }));
    };
    window.addEventListener(PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(PROGRESS_EVENT, onProgress);
  }, []);

  const level = levelOf(state.xpTotal);
  const xpShown = useCountUp(state.xpTotal);
  const lit = state.activeToday && state.streak > 0;
  const remaining = Math.max(0, dailyTotal - state.dailyDone);
  const reviews = state.dueReviews;
  const hasReview = premium && reviews > 0;
  const suggestReview = hasReview && (remaining === 0 || pathname === "/app/revisao");
  let destination = "/app/plantao";
  let action = state.dailyDone ? "Continuar plantão" : "Começar plantão";
  let context = "Plantão do Dia";
  let detail = remaining === 1 ? "Falta 1 questão" : `Faltam ${remaining} questões`;

  if (suggestReview) {
    destination = "/app/revisao";
    action = "Abrir revisão";
    context = "Revisão de hoje";
    detail = reviews === 1 ? "1 questão para revisar" : `${reviews} questões para revisar`;
  } else if (dailyTotal === 0) {
    destination = "/app/estudar";
    action = "Explorar estudos";
    detail = "Aguardando questões";
  } else if (remaining === 0) {
    action = "Ver resultado";
    detail = "Plantão concluído";
  }

  const current = pathname === destination;
  const focus = (
    <>
      <span className="study-focus-icon"><ToolIcon name={suggestReview ? "revisao" : "plantao"} /></span>
      <span className="study-focus-copy">
        <small>{context}{dailyTotal > 0 && !suggestReview && <span className="focus-count"> · {Math.min(state.dailyDone, dailyTotal)}/{dailyTotal}</span>}</small>
        <strong>{current ? detail : action}</strong>
        {dailyTotal > 0 && !suggestReview && (
          <span className="daily-segments" aria-hidden>
            {Array.from({ length: dailyTotal }, (_, i) => <i key={i} className={i < state.dailyDone ? "filled" : undefined} />)}
          </span>
        )}
      </span>
      {!current && <span className="study-focus-detail">{detail}</span>}
      {!current && <span className="study-focus-arrow" aria-hidden>→</span>}
    </>
  );

  return (
    <>
      {current ? <div className="study-focus">{focus}</div> : (
        <Link className="study-focus" href={destination}>{focus}</Link>
      )}
      <div className="study-metrics">
        {hasReview && !suggestReview && (
          <Link href="/app/revisao" className="study-review" aria-label={`Revisar ${reviews} questões pendentes`}>
            <ToolIcon name="revisao" /> {reviews}
          </Link>
        )}
        <Link href="/app/evolucao" className="study-level" title={level.next ? `Faltam ${level.toNext} XP para ${level.next.name}` : "Nível máximo"}>
          <span className="sr-only">Ver evolução </span><span><strong>{level.current.name}</strong><small key={gain} className={gain ? "xp-float" : undefined}>{xpShown} XP</small></span>
          <span className="study-level-track" aria-hidden><i style={{ width: `${level.progress * 100}%` }} /></span>
        </Link>
        <span className="study-streak" title={`${state.streak} dias de sequência. ${state.shields} de ${MAX_SHIELDS} trocas de plantão.`}>
          <Flame lit={lit} size={19} />
          <span><strong>{state.streak} {state.streak === 1 ? "dia" : "dias"}</strong><small>Sequência</small></span>
          <ShieldDots count={state.shields} max={MAX_SHIELDS} />
        </span>
      </div>
    </>
  );
}
