// O XP premia o comportamento que ensina, não só o acerto.

export const XP = {
  attempt: 2,
  correct: 10,
  errorDiagnosed: 3,
  reviewDone: 6,
  reviewCorrect: 4,
  dailyComplete: 20,
  dailyPerfect: 30,
  simuladoBase: 100,
  simuladoPerCorrect: 5,
  achievement: 50,
  commentVote: 5,
  commentVoteDailyCap: 25,
} as const;

export const LEVELS = [
  { min: 0, name: "Doutorando" },
  { min: 200, name: "Interno" },
  { min: 500, name: "R1" },
  { min: 1000, name: "R2" },
  { min: 1800, name: "R3" },
  { min: 3000, name: "Chefe de plantão" },
  { min: 5000, name: "Preceptor" },
] as const;

export function levelOf(xp: number) {
  let index = 0;
  while (index < LEVELS.length - 1 && xp >= LEVELS[index + 1].min) index++;
  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  const progress = next ? (xp - current.min) / (next.min - current.min) : 1;
  return { index, current, next, progress: Math.max(0, Math.min(1, progress)), toNext: next ? next.min - xp : 0 };
}

export type XpEntry = { amount: number; kind: string; ref: string };

export function xpForAnswer(args: {
  questionId: string;
  mode: "daily" | "training" | "review";
  context: string;
  correct: boolean;
}): XpEntry[] {
  const { questionId, mode, context, correct } = args;
  const ref = `${mode}:${context}:${questionId}`;
  if (mode === "review") {
    const out: XpEntry[] = [{ amount: XP.reviewDone, kind: "review", ref }];
    if (correct) out.push({ amount: XP.reviewCorrect, kind: "review_correct", ref });
    return out;
  }
  const out: XpEntry[] = [{ amount: XP.attempt, kind: "attempt", ref }];
  if (correct) out.push({ amount: XP.correct, kind: "correct", ref });
  return out;
}

export function xpForDaily(day: string, correct: number, total: number): XpEntry[] {
  const out: XpEntry[] = [{ amount: XP.dailyComplete, kind: "daily_complete", ref: day }];
  if (total > 0 && correct === total) out.push({ amount: XP.dailyPerfect, kind: "daily_perfect", ref: day });
  return out;
}

export function xpForSimulado(correct: number): number {
  return XP.simuladoBase + correct * XP.simuladoPerCorrect;
}
