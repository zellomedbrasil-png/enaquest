// Onboarding: contas pequenas, sem banco, usadas pela tela e testadas à parte.

import { QUESTIONS_PER_HOUR } from "./plan";

export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;

/**
 * Basta o mês da prova. Gravamos o dia 15, o meio do mês, para a contagem errar no máximo duas semanas.
 * No mês atual, depois do dia 15, a data vira hoje para não ficar no passado.
 */
export function examDateFromMonth(year: number, month: number, today: string): string | null {
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  const date = `${year}-${String(month).padStart(2, "0")}-15`;
  if (date >= today) return date;
  return today.slice(0, 7) === date.slice(0, 7) ? today : null;
}

/** Mês e ano de uma data gravada, para reabrir o onboarding com a escolha anterior. */
export function monthOf(date: string | null): { year: number; month: number } | null {
  const match = date?.match(/^(\d{4})-(\d{2})-\d{2}$/);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

/** Um mês ainda dá para escolher se a prova nele não ficaria no passado. */
export function monthAvailable(year: number, month: number, today: string): boolean {
  return examDateFromMonth(year, month, today) !== null;
}

/** Quantas questões cabem em tantos minutos, com a leitura do comentário. */
export function questionsFor(minutes: number): number {
  return Math.round((minutes / 60) * QUESTIONS_PER_HOUR);
}

export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1).replace(".", ",")} h`;
}
