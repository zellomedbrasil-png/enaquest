import "server-only";
import { admin } from "@/lib/supabase/admin";
import { DIFFICULTY_LABEL, type Difficulty } from "@/lib/game/rating";

export type ExamTable = { title: string; rows: [string, string, string?][] };

export type PublicQuestion = {
  id: string;
  slug: string;
  areaId: string;
  theme: string;
  scenario: string;
  difficulty: Difficulty;
  difficultyLabel: string;
  stem: string;
  exams: ExamTable[] | null;
  options: string[];
  verification: string;
  origin: string;
  license: string;
};

export type Reveal = {
  correctIndex: number;
  quick: string;
  reasoning: string;
  distractors: { index: number; why: string }[];
  tip: string;
  pearl: string;
  competencyNote: string;
  sources: { title: string; publisher: string; year: number; url: string; locator: string | null }[];
  stats: { n: number; correctPct: number | null; optionPct: number[] };
};

// Lista explícita: gabarito e comentário não estão nessas colunas.
const PUBLIC_COLUMNS =
  "id, slug, area_id, theme, scenario, difficulty, stem, exams, options, verification, origin, license";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toPublicQuestion(row: any): PublicQuestion {
  return {
    id: row.id,
    slug: row.slug,
    areaId: row.area_id,
    theme: row.theme,
    scenario: row.scenario,
    difficulty: row.difficulty,
    difficultyLabel: DIFFICULTY_LABEL[row.difficulty as Difficulty],
    stem: row.stem,
    exams: row.exams,
    options: row.options,
    verification: row.verification,
    origin: row.origin,
    license: row.license,
  };
}

export async function getPublicQuestions(ids: string[], { publishedOnly = true } = {}): Promise<PublicQuestion[]> {
  if (!ids.length) return [];
  let query = admin().from("questions").select(PUBLIC_COLUMNS).in("id", ids);
  if (publishedOnly) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map<string, any>((data ?? []).map((row: any) => [row.id, row]));
  return ids.filter((id) => byId.has(id)).map((id) => toPublicQuestion(byId.get(id)));
}

/** Gabarito e comentário. Quem chama precisa garantir que a pessoa já respondeu. */
export async function getReveal(questionId: string): Promise<Reveal> {
  const db = admin();
  const [key, explanation, sources, stats] = await Promise.all([
    db.from("question_keys").select("correct_index").eq("question_id", questionId).single(),
    db.from("explanations").select("*").eq("question_id", questionId).single(),
    db.from("question_sources").select("locator, sources(title, publisher, year, url)").eq("question_id", questionId),
    db.from("item_stats").select("n, correct, option_counts").eq("question_id", questionId).maybeSingle(),
  ]);
  if (key.error) throw key.error;
  if (explanation.error) throw explanation.error;
  const n: number = stats.data?.n ?? 0;
  const counts: number[] = stats.data?.option_counts ?? [];
  return {
    correctIndex: key.data.correct_index,
    quick: explanation.data.quick,
    reasoning: explanation.data.reasoning,
    distractors: explanation.data.distractors,
    tip: explanation.data.tip,
    pearl: explanation.data.pearl,
    competencyNote: explanation.data.competency_note,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sources: (sources.data ?? []).map((row: any) => ({ ...row.sources, locator: row.locator })),
    stats: {
      n,
      correctPct: n >= 20 ? Math.round(((stats.data?.correct ?? 0) / n) * 100) : null,
      optionPct: n >= 20 ? counts.map((c) => Math.round((c / n) * 100)) : [],
    },
  };
}

export async function getSingleKey(questionId: string): Promise<number> {
  const { data, error } = await admin().from("question_keys").select("correct_index").eq("question_id", questionId).single();
  if (error) throw error;
  return data.correct_index;
}
