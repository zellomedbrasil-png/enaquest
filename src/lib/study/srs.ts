// Revisão espaçada com FSRS. O erro volta logo; o acerto seguro volta mais tarde.
import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";

const scheduler = fsrs({ enable_fuzz: false, request_retention: 0.9 });

export type Confidence = "certeza" | "duvida" | "chute";
export type StoredCard = { state: Card; due: string };

export function gradeFor(correct: boolean, confidence: Confidence | null | undefined): Grade {
  if (!correct) return Rating.Again;
  if (confidence === "chute") return Rating.Hard;
  if (confidence === "duvida") return Rating.Good;
  return Rating.Easy;
}

/** Entra na revisão quem errou ou acertou sem certeza. Quem já está na revisão continua. */
export function shouldSchedule(args: { correct: boolean; confidence?: Confidence | null; hasCard: boolean }): boolean {
  return args.hasCard || !args.correct || args.confidence !== "certeza";
}

export function reviveCard(state: unknown): Card {
  const c = state as Card & { due: string | Date; last_review?: string | Date | null };
  return {
    ...c,
    due: new Date(c.due),
    last_review: c.last_review ? new Date(c.last_review) : undefined,
  } as Card;
}

export function scheduleCard(
  previous: unknown | null,
  correct: boolean,
  confidence: Confidence | null | undefined,
  now: Date = new Date(),
): StoredCard {
  const card = previous ? reviveCard(previous) : createEmptyCard(now);
  const { card: next } = scheduler.next(card, now, gradeFor(correct, confidence));
  return { state: next, due: next.due.toISOString() };
}
