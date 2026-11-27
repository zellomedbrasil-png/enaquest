// Seu dia: o que estudar hoje dentro do tempo que a pessoa tem.
// Função pura, sem banco: o servidor junta os números e a tela só mostra o resultado.

import { quotas } from "@/lib/server/selection";
import { MIN_AREA_RESPONSES } from "./proficiency";
import { buildPlan, QUESTIONS_PER_HOUR, WEAK_BOOST } from "./plan";

export type DayBlockKind = "plantao" | "revisao" | "erros" | "novas" | "simulado";

/** Minutos por questão, contando a leitura do comentário. Revisão é mais rápida: a questão já é conhecida. */
export const MINUTES_PER: Record<Exclude<DayBlockKind, "simulado">, number> = {
  plantao: 60 / QUESTIONS_PER_HOUR,
  novas: 60 / QUESTIONS_PER_HOUR,
  erros: 3,
  revisao: 2,
};

/** Fatia máxima do tempo do dia para revisão e para refazer erros. O resto vai para questões novas. */
export const REVIEW_SHARE = 0.4;
export const ERRORS_SHARE = 0.15;
/** Abaixo disto a área é tratada como ponto fraco. */
export const WEAK_PCT = 70;
/** Área com poucas respostas ganha um reforço pequeno, para a estimativa sair. */
export const EVIDENCE_BOOST = 1.2;

export const DAILY_MINUTES_OPTIONS = [30, 60, 90, 120, 180] as const;
export const MIN_DAILY_MINUTES = 15;
export const MAX_DAILY_MINUTES = 300;

export type DayPlanArea = { id: string; name: string; color: string; share: number; pct: number | null; n: number };

export type DayPlanInput = {
  today: string; // AAAA-MM-DD
  minutes: number;
  examDate: string | null;
  plantao: { total: number; answered: number };
  /** Revisões vencidas agora. Cada revisão feita sai desta conta. */
  dueReviews: number;
  /** Questões cuja última resposta foi errada e que ainda não voltaram na revisão. */
  errorsToRedo: number;
  /** Questões publicadas que a pessoa nunca respondeu. */
  newAvailable: number;
  areas: DayPlanArea[];
  /** Respostas de hoje em cada bloco. */
  doneToday: { revisao: number; erros: number; novas: number };
  /** Já fez um simulado nos últimos 7 dias. */
  simuladoThisWeek: boolean;
};

export type DayBlock = {
  kind: DayBlockKind;
  /** Quantas questões o bloco tem hoje (0 no simulado, que é só sugestão). */
  target: number;
  done: number;
  minutes: number;
  /** Só em "novas": quantas questões de cada área. */
  areaQuotas?: Record<string, number>;
};

export type DayPhase = "base" | "consolidacao" | "reta";

export type DayPlan = {
  minutes: number;
  /** Soma dos minutos dos blocos; passa de `minutes` quando o Plantão sozinho já não cabe. */
  plannedMinutes: number;
  daysLeft: number | null;
  phase: DayPhase | null;
  blocks: DayBlock[];
  /** Revisões vencidas que não couberam hoje e ficam para amanhã. */
  overflowReviews: number;
  weakAreas: string[];
  /** Áreas com menos respostas do que o mínimo para estimar o acerto. */
  evidenceAreas: string[];
};

const DAY = 86_400_000;

function parseDay(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 60;
  return Math.min(Math.max(Math.round(minutes), MIN_DAILY_MINUTES), MAX_DAILY_MINUTES);
}

/** Fase do estudo pela data da prova, com as mesmas fases do plano de estudo público. */
export function phaseFor(today: string, examDate: string | null): { daysLeft: number | null; phase: DayPhase | null } {
  if (!examDate) return { daysLeft: null, phase: null };
  const daysLeft = Math.round((parseDay(examDate) - parseDay(today)) / DAY);
  if (!Number.isFinite(daysLeft) || daysLeft < 0) return { daysLeft: null, phase: null };
  const plan = buildPlan({ today, examDate, hoursPerWeek: 10, weakAreas: [], areas: [] });
  if (!plan) return { daysLeft, phase: "reta" };
  const weeksLeft = daysLeft / 7;
  const reta = plan.phases.find((p) => p.key === "reta")?.weeks ?? 0;
  const consolidacao = plan.phases.find((p) => p.key === "consolidacao")?.weeks ?? 0;
  if (weeksLeft <= reta) return { daysLeft, phase: "reta" };
  if (weeksLeft <= reta + consolidacao) return { daysLeft, phase: "consolidacao" };
  return { daysLeft, phase: "base" };
}

/** Peso de cada área nas questões novas: o peso da prova, reforçado onde a pessoa vai mal ou ainda não respondeu o bastante. */
export function areaWeight(area: DayPlanArea): number {
  if (area.pct !== null && area.pct < WEAK_PCT) return area.share * WEAK_BOOST;
  if (area.pct === null && area.n < MIN_AREA_RESPONSES) return area.share * EVIDENCE_BOOST;
  return area.share;
}

/** Cotas por área para `size` questões novas, com os mesmos pesos do plano do dia. */
export function newQuestionQuotas(areas: DayPlanArea[], size: number): Record<string, number> {
  return quotas(areas.map((area) => ({ id: area.id, exam_share: areaWeight(area) })), size);
}

export function buildDayPlan(input: DayPlanInput): DayPlan {
  const minutes = clampMinutes(input.minutes);
  const { daysLeft, phase } = phaseFor(input.today, input.examDate);
  const blocks: DayBlock[] = [];
  let left = minutes;

  // 1. Plantão: sempre primeiro e inteiro, mesmo que passe do tempo (é o que mantém a sequência).
  const plantaoMinutes = input.plantao.total * MINUTES_PER.plantao;
  blocks.push({ kind: "plantao", target: input.plantao.total, done: Math.min(input.plantao.answered, input.plantao.total), minutes: plantaoMinutes });
  left = Math.max(0, left - plantaoMinutes);

  // As metas contam o que já foi feito hoje, para o bloco não encolher enquanto a pessoa avança.
  // 2. Revisão vencida, até REVIEW_SHARE do dia.
  const reviewPool = input.dueReviews + input.doneToday.revisao;
  const reviewCap = Math.floor(Math.min(left, minutes * REVIEW_SHARE) / MINUTES_PER.revisao);
  const reviewTarget = Math.max(Math.min(reviewPool, reviewCap), Math.min(input.doneToday.revisao, reviewPool));
  blocks.push({ kind: "revisao", target: reviewTarget, done: Math.min(input.doneToday.revisao, reviewTarget), minutes: reviewTarget * MINUTES_PER.revisao });
  left = Math.max(0, left - reviewTarget * MINUTES_PER.revisao);

  // 3. Erros para refazer, até ERRORS_SHARE do dia.
  const errorPool = input.errorsToRedo + input.doneToday.erros;
  const errorCap = Math.floor(Math.min(left, minutes * ERRORS_SHARE) / MINUTES_PER.erros);
  const errorTarget = Math.max(Math.min(errorPool, errorCap), Math.min(input.doneToday.erros, errorPool));
  if (errorTarget > 0) {
    blocks.push({ kind: "erros", target: errorTarget, done: Math.min(input.doneToday.erros, errorTarget), minutes: errorTarget * MINUTES_PER.erros });
    left = Math.max(0, left - errorTarget * MINUTES_PER.erros);
  }

  // 4. Questões novas com o tempo que sobrou, no peso da prova reforçado nos pontos fracos.
  const newPool = input.newAvailable + input.doneToday.novas;
  const newTarget = Math.max(Math.min(newPool, Math.floor(left / MINUTES_PER.novas)), Math.min(input.doneToday.novas, newPool));
  if (newTarget > 0) {
    blocks.push({
      kind: "novas",
      target: newTarget,
      done: Math.min(input.doneToday.novas, newTarget),
      minutes: newTarget * MINUTES_PER.novas,
      areaQuotas: newQuestionQuotas(input.areas, newTarget),
    });
  }

  // 5. Reta final: um simulado por semana, como sugestão. Não entra na conta de minutos do dia.
  if (phase === "reta" && !input.simuladoThisWeek) {
    blocks.push({ kind: "simulado", target: 0, done: 0, minutes: 0 });
  }

  return {
    minutes,
    plannedMinutes: blocks.reduce((sum, block) => sum + block.minutes, 0),
    daysLeft,
    phase,
    blocks,
    overflowReviews: Math.max(0, reviewPool - reviewTarget),
    weakAreas: input.areas.filter((a) => a.pct !== null && a.pct < WEAK_PCT).map((a) => a.id),
    evidenceAreas: input.areas.filter((a) => a.pct === null && a.n < MIN_AREA_RESPONSES).map((a) => a.id),
  };
}
