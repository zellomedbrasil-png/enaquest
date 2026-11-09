import "server-only";
import { admin } from "@/lib/supabase/admin";
import { todayBR } from "@/lib/game/streak";
import { AppError, enforceRateLimit, isPremium } from "./session";
import { getPublicQuestions, getReveal, type PublicQuestion, type Reveal } from "./questions";
import { pickBalanced, seededShuffle } from "./selection";
import { randomUUID } from "node:crypto";

export type TrainingFilter = "novas" | "erradas" | "todas";

export async function startTraining(
  userId: string,
  options: { areaId?: string | null; filter: TrainingFilter; size: number },
): Promise<{ context: string; questions: PublicQuestion[] }> {
  if (!(await isPremium(userId))) throw new AppError("premium_required", "O Treino faz parte da assinatura.");
  await enforceRateLimit(`training:${userId}`, 30, 3600);
  const size = Math.min(Math.max(options.size, 5), 30);
  const db = admin();

  let query = db.from("questions").select("id, area_id").eq("status", "published");
  if (options.areaId) query = query.eq("area_id", options.areaId);
  const { data: pool } = await query;

  const { data: history } = await db.from("answers").select("question_id, is_correct, created_at").eq("user_id", userId).order("created_at");
  const last = new Map<string, boolean>();
  for (const row of history ?? []) last.set(row.question_id, row.is_correct);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let candidates = (pool ?? []) as any[];
  if (options.filter === "novas") candidates = candidates.filter((q) => !last.has(q.id));
  if (options.filter === "erradas") candidates = candidates.filter((q) => last.get(q.id) === false);

  const context = randomUUID();
  const { data: areas } = await db.from("matrix_areas").select("id, exam_share");
  const ids = options.areaId
    ? seededShuffle(candidates, context).slice(0, size).map((q) => q.id)
    : pickBalanced(candidates, areas ?? [], context, size);
  return { context, questions: await getPublicQuestions(ids) };
}

export async function getDueReviews(userId: string, limit = 20): Promise<{ context: string; total: number; questions: PublicQuestion[] }> {
  if (!(await isPremium(userId))) throw new AppError("premium_required", "A revisão faz parte da assinatura.");
  const db = admin();
  const now = new Date().toISOString();
  const { data, count } = await db
    .from("srs_cards")
    .select("question_id", { count: "exact" })
    .eq("user_id", userId)
    .lte("due", now)
    .order("due")
    .limit(limit);
  const ids = (data ?? []).map((row: { question_id: string }) => row.question_id);
  return { context: todayBR(), total: count ?? 0, questions: await getPublicQuestions(ids) };
}

export type NotebookEntry = {
  questionId: string;
  slug: string;
  theme: string;
  areaId: string;
  reason: string | null;
  when: string;
  due: string | null;
};

export async function getNotebook(userId: string): Promise<NotebookEntry[]> {
  const db = admin();
  const { data } = await db
    .from("answers")
    .select("question_id, error_reason, created_at, questions(slug, theme, area_id)")
    .eq("user_id", userId)
    .eq("is_correct", false)
    .order("created_at", { ascending: false })
    .limit(100);
  const { data: cards } = await db.from("srs_cards").select("question_id, due").eq("user_id", userId);
  const dueByQuestion = new Map<string, string>((cards ?? []).map((c: { question_id: string; due: string }) => [c.question_id, c.due]));
  const seen = new Set<string>();
  const out: NotebookEntry[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    if (seen.has(row.question_id)) continue;
    seen.add(row.question_id);
    out.push({
      questionId: row.question_id,
      slug: row.questions.slug,
      theme: row.questions.theme,
      areaId: row.questions.area_id,
      reason: row.error_reason,
      when: row.created_at,
      due: dueByQuestion.get(row.question_id) ?? null,
    });
  }
  return out;
}

/** Página de uma questão: gabarito e comentários só para quem já respondeu. */
export async function getQuestionPage(
  userId: string,
  slug: string,
): Promise<{ question: PublicQuestion; answer: { id: string; selected: number; correct: boolean; reason: string | null } | null; reveal: Reveal | null } | null> {
  const db = admin();
  const { data: row } = await db.from("questions").select("id, status").eq("slug", slug).maybeSingle();
  if (!row) return null;
  const [question] = await getPublicQuestions([row.id], { publishedOnly: false });
  if (!question) return null;
  const { data: answers } = await db
    .from("answers")
    .select("id, selected, is_correct, error_reason, created_at")
    .eq("user_id", userId)
    .eq("question_id", row.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const latest = answers?.[0];
  if (!latest) return row.status === "published" ? { question, answer: null, reveal: null } : null;
  return {
    question,
    answer: { id: latest.id, selected: latest.selected, correct: latest.is_correct, reason: latest.error_reason },
    reveal: await getReveal(row.id),
  };
}
