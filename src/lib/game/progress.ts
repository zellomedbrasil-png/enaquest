// Missões do dia e conquistas, calculadas a partir de estatísticas simples.

import { START_RATING } from "./rating";

export type DayStats = {
  answered: number;
  correct: number;
  dailyDone: boolean;
  reviews: number;
  diagnosed: number;
  areasTouched: number;
};

export type Mission = { id: string; text: string; current: number; goal: number; done: boolean };

const POOL: { id: string; text: string; goal: number; value: (s: DayStats) => number }[] = [
  { id: "m_q10", text: "Responda 10 questões", goal: 10, value: (s) => s.answered },
  { id: "m_q25", text: "Responda 25 questões", goal: 25, value: (s) => s.answered },
  { id: "m_ok7", text: "Acerte 7 questões", goal: 7, value: (s) => s.correct },
  { id: "m_rev5", text: "Revise 5 questões do caderno de erros", goal: 5, value: (s) => s.reviews },
  { id: "m_diag3", text: "Diagnostique 3 erros", goal: 3, value: (s) => s.diagnosed },
  { id: "m_area3", text: "Pratique 3 áreas diferentes", goal: 3, value: (s) => s.areasTouched },
];

export function missionsFor(day: string, stats: DayStats): Mission[] {
  let hash = 0;
  for (let i = 0; i < day.length; i++) hash = (hash * 31 + day.charCodeAt(i)) >>> 0;
  const first = POOL[hash % POOL.length];
  const rest = POOL.filter((m) => m.id !== first.id);
  const second = rest[(hash >>> 3) % rest.length];
  const daily: Mission = {
    id: "m_daily",
    text: "Complete o Plantão do Dia",
    current: stats.dailyDone ? 1 : 0,
    goal: 1,
    done: stats.dailyDone,
  };
  return [
    daily,
    ...[first, second].map((m) => {
      const current = Math.min(m.value(stats), m.goal);
      return { id: m.id, text: m.text, current, goal: m.goal, done: current >= m.goal };
    }),
  ];
}

export type LifetimeStats = {
  answered: number;
  correct: number;
  bestStreak: number;
  bestCombo: number;
  reviews: number;
  diagnosed: number;
  simulados: number;
  comments: number;
  commentVotes: number;
  rating: number;
  dailyPerfect: number;
};

export type AchievementDef = {
  id: string;
  name: string;
  description: string;
  goal: number;
  /** Ponto de partida da barra de progresso, quando o valor não começa em zero (ex.: rating). */
  base?: number;
  value: (s: LifetimeStats) => number;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "primeiro_plantao", name: "Primeiro plantão", description: "Responda sua primeira questão", goal: 1, value: (s) => s.answered },
  { id: "cem", name: "Cem casos", description: "Responda 100 questões", goal: 100, value: (s) => s.answered },
  { id: "mil", name: "Mil casos", description: "Responda 1.000 questões", goal: 1000, value: (s) => s.answered },
  { id: "semana", name: "Semana de plantão", description: "Mantenha 7 dias de sequência", goal: 7, value: (s) => s.bestStreak },
  { id: "mes", name: "Mês de plantão", description: "Mantenha 30 dias de sequência", goal: 30, value: (s) => s.bestStreak },
  { id: "combo10", name: "Mão quente", description: "Acerte 10 questões seguidas", goal: 10, value: (s) => s.bestCombo },
  { id: "perfeito", name: "Plantão perfeito", description: "Acerte todas do Plantão do Dia", goal: 1, value: (s) => s.dailyPerfect },
  { id: "autopsia", name: "Revisão de caso", description: "Diagnostique 25 erros seus", goal: 25, value: (s) => s.diagnosed },
  { id: "revisor", name: "Volta ao leito", description: "Faça 100 revisões", goal: 100, value: (s) => s.reviews },
  { id: "maratona", name: "Prova de resistência", description: "Conclua um simulado completo", goal: 1, value: (s) => s.simulados },
  { id: "preceptor", name: "Espírito de preceptor", description: "Receba 10 votos em comentários", goal: 10, value: (s) => s.commentVotes },
  { id: "platina", name: "Platina", description: "Chegue à patente Platina", goal: 1300, base: START_RATING, value: (s) => s.rating },
];

export type AchievementProgress = {
  id: string;
  name: string;
  description: string;
  goal: number;
  current: number;
  /** De 0 a 1. */
  pct: number;
  unlocked: boolean;
};

export function achievementProgress(stats: LifetimeStats, owned: Set<string>): AchievementProgress[] {
  return ACHIEVEMENTS.map((a) => {
    const unlocked = owned.has(a.id);
    const base = a.base ?? 0;
    const value = a.value(stats);
    const pct = unlocked ? 1 : Math.max(0, Math.min(1, (value - base) / (a.goal - base)));
    return {
      id: a.id,
      name: a.name,
      description: a.description,
      goal: a.goal,
      current: unlocked ? a.goal : Math.max(0, Math.min(Math.round(value), a.goal)),
      pct,
      unlocked,
    };
  });
}

/** As conquistas ainda não ganhas que estão mais perto de sair. */
export function closestAchievements(list: AchievementProgress[], count = 3): AchievementProgress[] {
  return list
    .filter((a) => !a.unlocked && a.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, count);
}

export function unlockedAchievements(stats: LifetimeStats, already: Set<string>): string[] {
  return ACHIEVEMENTS.filter((a) => !already.has(a.id) && a.value(stats) >= a.goal).map((a) => a.id);
}
