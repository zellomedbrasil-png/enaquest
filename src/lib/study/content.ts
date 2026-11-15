// Formato do conteúdo de estudo extra de cada questão. Texto puro em JSON, sem markdown.
import { z } from "zod";

export const TheorySchema = z.object({
  title: z.string().min(3).max(90),
  intro: z.string().min(20).max(600),
  sections: z
    .array(
      z.object({
        heading: z.string().min(3).max(80),
        body: z.string().max(700).optional(),
        items: z.array(z.string().min(3).max(300)).max(8).optional(),
      }),
    )
    .min(1)
    .max(5),
  alert: z.string().max(400).optional(),
});
export type Theory = z.infer<typeof TheorySchema>;

export const SummarySchema = z.object({
  title: z.string().min(3).max(90),
  points: z
    .array(
      z.object({
        label: z.string().min(2).max(50),
        text: z.string().min(3).max(300),
        sub: z.array(z.string().min(3).max(200)).max(5).optional(),
      }),
    )
    .min(3)
    .max(8),
});
export type Summary = z.infer<typeof SummarySchema>;

/** Aceita o que veio do banco só se tiver o formato certo; senão, o cartão some. */
export function parseTheory(value: unknown): Theory | null {
  const parsed = TheorySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseSummary(value: unknown): Summary | null {
  const parsed = SummarySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
