// A jornada do dia: o que o estudante deve fazer agora, o que vem depois e em que etapa ele está.
// Tudo aqui é função pura, para o texto da tela Hoje poder ser testado sem banco.

import type { DayBlock, DayPlan } from "@/lib/study/day-plan";
import { PLACEMENT_GAMES } from "./rating";

export type JourneyStage = "novo" | "nivelamento" | "ativo";

/** novo: ainda não respondeu nada. nivelamento: está calibrando o rating. ativo: já passou disso. */
export function journeyStage(input: { answered: number; ratedGames: number }): JourneyStage {
  if (input.answered === 0) return "novo";
  if (input.ratedGames < PLACEMENT_GAMES) return "nivelamento";
  return "ativo";
}

/** clear: nada a fazer neste passo agora (diferente de done, que é algo já cumprido). */
export type StepState = "done" | "now" | "next" | "locked" | "clear";

export type JourneyStep = {
  id: "plantao" | "revisao" | "missao" | "erros" | "novas" | "simulado";
  title: string;
  detail: string;
  href: string | null;
  state: StepState;
  /** Sugestão: aparece na lista, mas não vira o passo atual nem impede o dia de fechar. */
  optional?: boolean;
  /** Seu dia: questões e minutos planejados para o passo. */
  target?: number;
  done?: number;
  minutes?: number;
  /** Texto imperativo do botão quando este é o passo atual. */
  cta: string;
  /** Título do banner quando este é o passo atual. */
  heroTitle: string;
  heroText: string;
};

export type JourneyInput = {
  premium: boolean;
  dailyTotal: number;
  dailyAnswered: number;
  dailyHits: number;
  dueReviews: number;
  /** Missões além do Plantão: quantas estão feitas, quantas existem e o texto da primeira pendente. */
  extraMissionsDone: number;
  extraMissionsTotal: number;
  nextMissionText: string | null;
  /** Onde cumprir a primeira missão pendente: a revisão e o treino contam em lugares diferentes. */
  nextMissionHref?: string;
  /** Seu dia: com o plano, os passos vêm dos blocos dele em vez de Revisão + Missões. */
  day?: DayPlan;
};

export type NextStep = {
  title: string;
  text: string;
  cta: string | null;
  href: string | null;
  /** true quando não resta nada a fazer hoje. */
  allDone: boolean;
};

export type Journey = { steps: JourneyStep[]; next: NextStep; remaining: number };

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function buildJourney(input: JourneyInput): Journey {
  const { premium, dailyTotal, dailyAnswered, dailyHits, dueReviews } = input;
  const dailyDone = dailyTotal > 0 && dailyAnswered >= dailyTotal;
  const dailyLeft = Math.max(0, dailyTotal - dailyAnswered);

  const plantao: JourneyStep = {
    id: "plantao",
    title: "Plantão do Dia",
    href: "/app/plantao",
    state: dailyTotal === 0 ? "locked" : dailyDone ? "done" : "next",
    detail:
      dailyTotal === 0
        ? "Ainda não há questões publicadas para hoje."
        : dailyDone
          ? `Concluído: ${dailyHits} de ${dailyTotal} certas.`
          : dailyAnswered > 0
            ? `Faltam ${plural(dailyLeft, "questão", "questões")}.`
            : `${dailyTotal} questões iguais para todo mundo.`,
    cta: dailyAnswered > 0 ? "Continuar" : "Começar",
    heroTitle: dailyAnswered > 0 ? "Termine o Plantão de hoje" : "Faça o Plantão de hoje",
    heroText:
      dailyAnswered > 0
        ? `Faltam ${plural(dailyLeft, "questão", "questões")}. Continue de onde parou.`
        : `${dailyTotal} questões comentadas, iguais para todo mundo. Cada resposta mantém sua sequência.`,
  };

  const revisao: JourneyStep = {
    id: "revisao",
    title: "Revisão",
    href: premium ? "/app/revisao" : null,
    state: !premium ? "locked" : dueReviews > 0 ? "next" : "clear",
    detail: !premium ? "Faz parte da assinatura." : dueReviews > 0 ? `${plural(dueReviews, "questão voltou", "questões voltaram")} para você.` : "Nada para revisar agora.",
    cta: "Revisar",
    heroTitle: `Revise ${plural(dueReviews, "questão", "questões")}`,
    heroText: "Elas voltaram na hora certa para você não esquecer o que errou.",
  };

  const missaoDone = input.extraMissionsTotal > 0 && input.extraMissionsDone >= input.extraMissionsTotal;
  const missao: JourneyStep = {
    id: "missao",
    title: "Missões do dia",
    href: premium ? (input.nextMissionHref ?? "/app/treino") : null,
    state: !premium || input.extraMissionsTotal === 0 ? "locked" : missaoDone ? "done" : "next",
    detail: !premium
      ? "Missões extras fazem parte da assinatura."
      : missaoDone
        ? "Todas cumpridas."
        : `${input.nextMissionText ?? "Cumpra as missões"} (${input.extraMissionsDone} de ${input.extraMissionsTotal} feitas).`,
    cta: "Treinar",
    heroTitle: input.nextMissionText ?? "Cumpra as missões do dia",
    heroText: "Treine por área para completar. Cada missão rende XP e aproxima você da próxima conquista.",
  };

  if (input.day) {
    plantao.target = dailyTotal;
    plantao.done = Math.min(dailyAnswered, dailyTotal);
    plantao.minutes = input.day.blocks.find((b) => b.kind === "plantao")?.minutes;
  }
  const steps = input.day ? [plantao, ...dayBlockSteps(input.day, premium)] : [plantao, revisao, missao];

  // O primeiro passo pendente e liberado é o "agora"; os demais pendentes ficam como "depois".
  let found = false;
  for (const step of steps) {
    if (step.state === "next" && !step.optional) {
      if (!found) {
        step.state = "now";
        found = true;
      }
    }
  }

  const current = steps.find((s) => s.state === "now") ?? null;
  const remaining = steps.filter((s) => !s.optional && (s.state === "now" || s.state === "next")).length;
  const lockedQuestions = steps.filter((s) => s.state === "locked" && s.id !== "plantao").reduce((sum, s) => sum + (s.target ?? 0), 0);

  // Sem questões publicadas não há o que comemorar: o dia não está "feito", o plantão é que não foi escalado.
  const next: NextStep = current
    ? { title: current.heroTitle, text: current.heroText, cta: current.cta, href: current.href, allDone: false }
    : dailyTotal === 0
      ? {
          title: "O plantão de hoje ainda não foi escalado",
          text: "Assim que as questões forem publicadas, elas aparecem aqui. Enquanto isso, conheça como o EnaQuest funciona.",
          cta: "Como funciona",
          href: "/app/como-funciona",
          allDone: false,
        }
      : !premium && lockedQuestions > 0
        ? {
            title: "Plantão feito. Seu dia tem mais",
            text: `Seu plano de hoje tem mais ${plural(lockedQuestions, "questão", "questões")} para você: revisão, erros e questões novas nas suas áreas fracas. Elas fazem parte da assinatura.`,
            cta: "Ver assinatura",
            href: "/planos",
            allDone: true,
          }
        : {
            title: "Hoje está feito",
            text: premium ? "Volte amanhã para manter a sequência. Se quiser estudar mais, faça um Treino." : "Volte amanhã para manter a sequência. Novas questões à meia-noite.",
            cta: premium ? "Treinar mais" : null,
            href: premium ? "/app/treino" : null,
            allDone: true,
          };

  return { steps, next, remaining };
}

const BLOCK_TEXT: Record<"revisao" | "erros" | "novas", { title: string; cta: string; heroTitle: (left: number) => string; heroText: string }> = {
  revisao: {
    title: "Revisão",
    cta: "Revisar",
    heroTitle: (left) => `Revise ${plural(left, "questão", "questões")}`,
    heroText: "Elas voltaram na hora certa para você não esquecer o que errou.",
  },
  erros: {
    title: "Erros para refazer",
    cta: "Refazer",
    heroTitle: (left) => `Refaça ${plural(left, "erro", "erros")}`,
    heroText: "Questões que você errou e ainda não voltaram na revisão. Acertar agora tira do caderno.",
  },
  novas: {
    title: "Questões novas",
    cta: "Começar",
    heroTitle: (left) => `Faça ${plural(left, "questão nova", "questões novas")}`,
    heroText: "Escolhidas no peso da prova, com mais questões nas áreas em que você vai pior.",
  },
};

function blockStep(block: DayBlock, premium: boolean, overflow: number): JourneyStep | null {
  if (block.kind === "plantao") return null;
  if (block.kind === "simulado") {
    return {
      id: "simulado",
      title: "Simulado da semana",
      detail: premium ? "Reta final: um simulado com tempo de prova por semana. Escolha um dia com tempo livre." : "Na reta final, um simulado por semana. Faz parte da assinatura.",
      href: premium ? "/app/simulados" : null,
      state: premium ? "next" : "locked",
      optional: true,
      cta: "Ver simulados",
      heroTitle: "Faça o simulado da semana",
      heroText: "Prova completa, com tempo, como no dia.",
    };
  }
  const text = BLOCK_TEXT[block.kind];
  const left = Math.max(0, block.target - block.done);
  const empty = block.target === 0;
  const state: StepState = !premium ? (empty ? "clear" : "locked") : empty ? "clear" : left === 0 ? "done" : "next";
  const timeNote = `${plural(block.target, "questão", "questões")}, cerca de ${block.minutes} min`;
  const detail = empty
    ? overflow > 0 && block.kind === "revisao"
      ? `Sem tempo hoje: ${plural(overflow, "revisão fica", "revisões ficam")} para amanhã.`
      : block.kind === "revisao"
        ? "Nada para revisar agora."
        : "Nada pendente."
    : !premium
      ? `${timeNote}. Faz parte da assinatura.`
      : left === 0
        ? `Concluído: ${plural(block.target, "questão", "questões")}.`
        : block.done > 0
          ? `Faltam ${left} de ${timeNote}.`
          : block.kind === "revisao" && overflow > 0
            ? `${timeNote}. Mais ${overflow} ficam para amanhã.`
            : `${timeNote}.`;
  return {
    id: block.kind,
    title: text.title,
    detail,
    href: premium && !empty ? `/app/dia/${block.kind}` : null,
    state,
    target: block.target,
    done: block.done,
    minutes: block.minutes,
    cta: block.done > 0 ? "Continuar" : text.cta,
    heroTitle: text.heroTitle(left),
    heroText: text.heroText,
  };
}

function dayBlockSteps(day: DayPlan, premium: boolean): JourneyStep[] {
  return day.blocks.map((block) => blockStep(block, premium, day.overflowReviews)).filter((step): step is JourneyStep => step !== null);
}
