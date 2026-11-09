// A jornada do dia: o que o estudante deve fazer agora, o que vem depois e em que etapa ele está.
// Tudo aqui é função pura, para o texto da tela Hoje poder ser testado sem banco.

import { PLACEMENT_GAMES } from "./rating";

export type JourneyStage = "novo" | "nivelamento" | "ativo";

/** novo: ainda não respondeu nada. nivelamento: está calibrando o rating. ativo: já passou disso. */
export function journeyStage(input: { answered: number; ratedGames: number }): JourneyStage {
  if (input.answered === 0) return "novo";
  if (input.ratedGames < PLACEMENT_GAMES) return "nivelamento";
  return "ativo";
}

export type StepState = "done" | "now" | "next" | "locked";

export type JourneyStep = {
  id: "plantao" | "revisao" | "missao";
  title: string;
  detail: string;
  href: string | null;
  state: StepState;
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
    state: !premium ? "locked" : dueReviews > 0 ? "next" : "done",
    detail: !premium ? "Faz parte da assinatura." : dueReviews > 0 ? `${plural(dueReviews, "questão voltou", "questões voltaram")} para você.` : "Nada para revisar agora.",
    cta: "Revisar",
    heroTitle: `Revise ${plural(dueReviews, "questão", "questões")}`,
    heroText: "Elas voltaram na hora certa para você não esquecer o que errou.",
  };

  const missaoDone = input.extraMissionsTotal > 0 && input.extraMissionsDone >= input.extraMissionsTotal;
  const missao: JourneyStep = {
    id: "missao",
    title: "Missões do dia",
    href: premium ? "/app/treino" : null,
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

  const steps = [plantao, revisao, missao];

  // O primeiro passo pendente e liberado é o "agora"; os demais pendentes ficam como "depois".
  let found = false;
  for (const step of steps) {
    if (step.state === "next") {
      if (!found) {
        step.state = "now";
        found = true;
      }
    }
  }

  const current = steps.find((s) => s.state === "now") ?? null;
  const remaining = steps.filter((s) => s.state === "now" || s.state === "next").length;

  const next: NextStep = current
    ? { title: current.heroTitle, text: current.heroText, cta: current.cta, href: current.href, allDone: false }
    : {
        title: "Hoje está feito",
        text: premium ? "Volte amanhã para manter a sequência. Se quiser estudar mais, faça um Treino." : "Volte amanhã para manter a sequência. Novas questões à meia-noite.",
        cta: premium ? "Treinar mais" : null,
        href: premium ? "/app/treino" : null,
        allDone: true,
      };

  return { steps, next, remaining };
}
