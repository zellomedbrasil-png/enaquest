// Rating no estilo Elo. Na prática é uma aproximação do modelo de Rasch usado pelo Inep,
// o que permite reaproveitar o mesmo número no Termômetro de Proficiência.

export const START_RATING = 900;
export const PLACEMENT_GAMES = 20;

export type Difficulty = "facil" | "medio" | "dificil" | "muito_dificil";

export const DIFFICULTY_RATING: Record<Difficulty, number> = {
  facil: 1100,
  medio: 1300,
  dificil: 1500,
  muito_dificil: 1650,
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
  muito_dificil: "Muito difícil",
};

export const TIERS = [
  { min: 0, name: "Bronze", from: "#e0a273", to: "#8a4f2a" },
  { min: 1000, name: "Prata", from: "#e6ecf7", to: "#7d8aa3" },
  { min: 1150, name: "Ouro", from: "#ffe27a", to: "#c2860f" },
  { min: 1300, name: "Platina", from: "#a8fff0", to: "#2a9c8c" },
  { min: 1450, name: "Diamante", from: "#a9d2ff", to: "#3563d6" },
  { min: 1600, name: "Mestre", from: "#e2b8ff", to: "#7a3bc9" },
  { min: 1800, name: "Grão-Mestre", from: "#ffb0a6", to: "#d1271b" },
] as const;

export type Tier = (typeof TIERS)[number];

export function tierOf(rating: number): { tier: Tier; next: Tier | null; index: number } {
  let index = 0;
  while (index < TIERS.length - 1 && rating >= TIERS[index + 1].min) index++;
  return { tier: TIERS[index], next: TIERS[index + 1] ?? null, index };
}

export function expectedScore(rating: number, itemRating: number): number {
  return 1 / (1 + Math.pow(10, (itemRating - rating) / 400));
}

/**
 * Variação do rating após uma resposta. Durante o nivelamento o passo é maior e nunca
 * tira pontos em excesso: o iniciante encontra seu nível sem sofrer logo no começo.
 */
export function ratingDelta(rating: number, itemRating: number, correct: boolean, games: number): number {
  const inPlacement = games < PLACEMENT_GAMES;
  const k = inPlacement ? 40 : 24;
  let delta = Math.round(k * ((correct ? 1 : 0) - expectedScore(rating, itemRating)));
  if (correct && delta < 1) delta = 1;
  if (!correct && delta > -1) delta = -1;
  if (inPlacement && delta < 0) delta = Math.max(delta, -12);
  return delta;
}

/** A dificuldade da questão se ajusta aos poucos com as respostas reais. */
export function itemRatingAfter(rating: number, itemRating: number, correct: boolean): number {
  const k = 4;
  const next = itemRating + k * (expectedScore(rating, itemRating) - (correct ? 1 : 0));
  return Math.round(Math.min(2100, Math.max(700, next)) * 100) / 100;
}

/** Grupos usados para medir se a questão separa quem sabe de quem não sabe. */
export function discriminationBucket(rating: number, games: number): "upper" | "lower" | null {
  if (games < PLACEMENT_GAMES) return null;
  if (rating >= 1300) return "upper";
  if (rating < 1100) return "lower";
  return null;
}
