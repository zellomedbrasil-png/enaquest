// Plano do dia: quais temas viram questão hoje. Sem rede e sem banco, para testar.
import { z } from "zod";
import { quotas, seededShuffle } from "../../src/lib/server/selection";
import { AREA_IDS, COMPETENCY_IDS, DIFFICULTIES } from "./schema";

const ThemeSchema = z.object({
  tema: z.string().min(3),
  competencias: z.array(z.enum(COMPETENCY_IDS)).min(1),
  risco: z.enum(["normal", "alto"]),
  fontes: z.array(z.string()).default([]),
  /** Atualização recente de diretriz que os modelos ainda não conhecem bem. Vai no pedido ao autor. */
  nota: z.string().optional(),
});

export const TemarioSchema = z.object({
  nota: z.string().optional(),
  cenarios: z.record(z.enum(AREA_IDS), z.array(z.string()).min(1)),
  temas: z.record(z.enum(AREA_IDS), z.array(ThemeSchema).min(1)),
});
export type Temario = z.infer<typeof TemarioSchema>;

/** Proporção medida no caderno do ENAMED 2026 (docs/matriz-enamed-2026.md e supabase/seed.sql). */
export const AREA_SHARES = [
  { id: "clinica", exam_share: 0.18 },
  { id: "pediatria", exam_share: 0.16 },
  { id: "go", exam_share: 0.15 },
  { id: "cirurgia", exam_share: 0.14 },
  { id: "mental", exam_share: 0.14 },
  { id: "coletiva", exam_share: 0.12 },
  { id: "mfc", exam_share: 0.11 },
];

// Mais questões médias e difíceis, como na prova.
const DIFFICULTY_WEIGHTS: [(typeof DIFFICULTIES)[number], number][] = [
  ["facil", 0.15],
  ["medio", 0.45],
  ["dificil", 0.3],
  ["muito_dificil", 0.1],
];

export type PlanItem = {
  area_id: (typeof AREA_IDS)[number];
  theme: string;
  competency_id: (typeof COMPETENCY_IDS)[number];
  scenario: string;
  difficulty: (typeof DIFFICULTIES)[number];
  risk_level: "normal" | "alto";
  source_ids: string[];
  note?: string;
};

function pick<T>(items: T[], seed: string): T {
  return seededShuffle(items, seed)[0];
}

function pickDifficulty(seed: string): PlanItem["difficulty"] {
  const roll = seededShuffle(Array.from({ length: 100 }, (_, i) => i), seed)[0] / 100;
  let acc = 0;
  for (const [level, weight] of DIFFICULTY_WEIGHTS) {
    acc += weight;
    if (roll < acc) return level;
  }
  return "medio";
}

/**
 * Escolhe `size` temas na proporção das áreas, preferindo os menos usados (usage: tema → questões já geradas).
 * A semente (a data) desempata, para o mesmo dia dar o mesmo plano.
 */
export function planDay(temario: Temario, usage: Record<string, number>, size: number, seed: string): PlanItem[] {
  const perArea = quotas(AREA_SHARES, size);
  const plan: PlanItem[] = [];
  for (const area of AREA_IDS) {
    const themes = temario.temas[area] ?? [];
    const want = perArea[area] ?? 0;
    if (!themes.length || !want) continue;
    const ordered = seededShuffle(themes, `${seed}:${area}`).sort((a, b) => (usage[a.tema] ?? 0) - (usage[b.tema] ?? 0));
    for (let i = 0; i < want; i++) {
      const theme = ordered[i % ordered.length];
      const used = (usage[theme.tema] ?? 0) + Math.floor(i / ordered.length);
      plan.push({
        area_id: area,
        theme: theme.tema,
        // Gira a competência a cada vez que o tema volta, para não repetir a mesma pergunta.
        competency_id: theme.competencias[used % theme.competencias.length],
        scenario: pick(temario.cenarios[area] ?? ["UBS"], `${seed}:${area}:${i}:cenario`),
        difficulty: pickDifficulty(`${seed}:${area}:${i}:dificuldade`),
        risk_level: theme.risco,
        source_ids: theme.fontes,
        note: theme.nota,
      });
    }
  }
  return plan;
}
