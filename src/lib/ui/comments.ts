import type { Reveal } from "@/lib/server/questions";

/** Comentário de cada alternativa a partir do comentário da questão. */
export function optionComments(reveal: Reveal): Record<number, string> {
  const out: Record<number, string> = { [reveal.correctIndex]: reveal.keyWhy ?? reveal.quick };
  for (const item of reveal.distractors) out[item.index] = item.why;
  return out;
}
