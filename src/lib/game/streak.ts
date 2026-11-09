// Sequência de dias, com "troca de plantão": uma falta pode ser coberta por um escudo.

export type StreakState = {
  current: number;
  best: number;
  last_active: string | null;
  shields: number;
};

export const MAX_SHIELDS = 2;
export const SHIELD_EVERY = 7;

function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from));
}

/** Soma dias a uma data AAAA-MM-DD (aritmética de calendário, sem fuso). */
export function addDays(day: string, amount: number): string {
  return new Date((dayNumber(day) + amount) * 86_400_000).toISOString().slice(0, 10);
}

export function nextStreak(state: StreakState, today: string): StreakState & { usedShield: boolean; earnedShield: boolean } {
  if (state.last_active === today) return { ...state, usedShield: false, earnedShield: false };

  const gap = state.last_active ? daysBetween(state.last_active, today) : null;
  let current: number;
  let shields = state.shields;
  let usedShield = false;

  if (gap === 1) {
    current = state.current + 1;
  } else if (gap === 2 && shields > 0) {
    current = state.current + 1;
    shields -= 1;
    usedShield = true;
  } else {
    current = 1;
  }

  let earnedShield = false;
  if (current % SHIELD_EVERY === 0 && shields < MAX_SHIELDS) {
    shields += 1;
    earnedShield = true;
  }

  return { current, best: Math.max(state.best, current), last_active: today, shields, usedShield, earnedShield };
}

/** Sequência que o usuário enxerga hoje, antes de responder alguma questão. */
export function displayedStreak(state: StreakState, today: string): number {
  if (!state.last_active) return 0;
  const gap = daysBetween(state.last_active, today);
  if (gap <= 1) return state.current;
  if (gap === 2 && state.shields > 0) return state.current;
  return 0;
}

export function todayBR(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
