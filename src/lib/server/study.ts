import "server-only";
import { admin } from "@/lib/supabase/admin";
import { todayBR } from "@/lib/game/streak";
import { addDays, buildAgenda, type AgendaDay } from "@/lib/study/agenda";
import { scheduleCard } from "@/lib/study/srs";
import {
  filterPool,
  themesByArea,
  type PoolQuestion,
  type TrainingFilters,
  type TrainingHistory,
  type TrainingStatus,
} from "@/lib/study/training-filter";
import { AppError, enforceRateLimit, isPremium } from "./session";
import { getPublicQuestions, getReveal, PLAYABLE_LICENSES, type PublicQuestion, type Reveal } from "./questions";
import { pickBalanced, seededShuffle } from "./selection";
import { randomUUID } from "node:crypto";

export type TrainingFilter = TrainingStatus;

/** Quantas questões já voltaram para revisão. Uma regra só para Hoje, Estudar e Evolução. */
export async function countDueReviews(userId: string): Promise<number> {
  const { count } = await admin()
    .from("srs_cards")
    .select("question_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .lte("due", new Date().toISOString());
  return count ?? 0;
}

/** Quantas questões voltam em cada um dos próximos 7 dias (atrasadas entram em hoje). */
export async function reviewAgenda(userId: string): Promise<AgendaDay[]> {
  const today = todayBR();
  const { data } = await admin()
    .from("srs_cards")
    .select("due")
    .eq("user_id", userId)
    .lt("due", new Date(`${addDays(today, 8)}T12:00:00Z`).toISOString())
    .limit(5000);
  const days = (data ?? []).map((row: { due: string }) => todayBR(new Date(row.due)));
  return buildAgenda(days, today);
}

/** Questões que podem entrar em rodada, com o que os filtros do Treino precisam. */
export async function playablePool(): Promise<PoolQuestion[]> {
  const { data } = await admin()
    .from("questions")
    .select("id, area_id, theme, difficulty, official_exam_id, images")
    .eq("status", "published")
    .in("license", PLAYABLE_LICENSES)
    .eq("annulled", false)
    .is("outdated_note", null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((q) => ({
    id: q.id,
    area_id: q.area_id,
    theme: q.theme,
    difficulty: q.difficulty,
    official_exam_id: q.official_exam_id,
    has_images: Array.isArray(q.images) && q.images.length > 0,
  }));
}

async function trainingHistory(userId: string): Promise<TrainingHistory> {
  const db = admin();
  const [{ data: answers }, { data: marks }] = await Promise.all([
    db.from("answers").select("question_id, is_correct, confidence, created_at").eq("user_id", userId).order("created_at"),
    db.from("question_marks").select("question_id").eq("user_id", userId),
  ]);
  const last: TrainingHistory["last"] = new Map();
  for (const row of answers ?? []) last.set(row.question_id, { correct: row.is_correct, confidence: row.confidence });
  return { last, marked: new Set((marks ?? []).map((m: { question_id: string }) => m.question_id)) };
}

export type TrainingOptions = Partial<Omit<TrainingFilters, "status">> & { filter: TrainingFilter; size: number };

function toFilters(options: TrainingOptions): TrainingFilters {
  return {
    areaId: options.areaId ?? null,
    theme: options.areaId ? (options.theme ?? null) : null,
    source: options.source ?? "todas",
    difficulties: options.difficulties ?? [],
    status: options.filter,
    withImages: options.withImages ?? false,
  };
}

/** Quantas questões batem com os filtros. Livre para todos, para o plano grátis ver o tamanho do banco. */
export async function countTraining(userId: string, options: TrainingOptions): Promise<number> {
  await enforceRateLimit(`training-count:${userId}`, 240, 3600);
  const [pool, history] = await Promise.all([playablePool(), trainingHistory(userId)]);
  return filterPool(pool, history, toFilters(options)).length;
}

export type TrainingCatalog = {
  themes: Record<string, { theme: string; count: number }[]>;
  exams: { id: string; name: string; count: number }[];
  authored: number;
  withImages: number;
};

/** O que existe no banco para montar os filtros: temas por área e provas oficiais. */
export async function trainingCatalog(): Promise<TrainingCatalog> {
  const [pool, { data: exams }] = await Promise.all([
    playablePool(),
    admin().from("official_exams").select("id, name, booklet, year").order("year", { ascending: false }),
  ]);
  const perExam = new Map<string, number>();
  for (const q of pool) if (q.official_exam_id) perExam.set(q.official_exam_id, (perExam.get(q.official_exam_id) ?? 0) + 1);
  return {
    themes: themesByArea(pool),
    exams: (exams ?? [])
      .filter((e: { id: string }) => perExam.has(e.id))
      .map((e: { id: string; name: string; booklet: string | null }) => ({ id: e.id, name: e.booklet ? `${e.name} · ${e.booklet}` : e.name, count: perExam.get(e.id) ?? 0 })),
    authored: pool.filter((q) => !q.official_exam_id).length,
    withImages: pool.filter((q) => q.has_images).length,
  };
}

export async function startTraining(userId: string, options: TrainingOptions): Promise<{ context: string; questions: PublicQuestion[] }> {
  if (!(await isPremium(userId))) throw new AppError("premium_required", "O Treino faz parte da assinatura.");
  await enforceRateLimit(`training:${userId}`, 30, 3600);
  const size = Math.min(Math.max(options.size, 5), 30);
  const filters = toFilters(options);
  const [pool, history] = await Promise.all([playablePool(), trainingHistory(userId)]);
  const candidates = filterPool(pool, history, filters);

  const context = randomUUID();
  // Com área, tema ou prova escolhidos, a pessoa já disse o que quer: só embaralha. Sem nada, segue o peso da prova.
  const free = !filters.areaId && filters.source === "todas" && filters.difficulties.length === 0 && !filters.withImages;
  let ids: string[];
  if (free) {
    const { data: areas } = await admin().from("matrix_areas").select("id, exam_share");
    ids = pickBalanced(candidates, areas ?? [], context, size);
  } else {
    ids = seededShuffle(candidates, context).slice(0, size).map((q) => q.id);
  }
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
  /** Já voltou para revisão. */
  ready: boolean;
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
  const now = Date.now();
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
      ready: dueByQuestion.has(row.question_id) && new Date(dueByQuestion.get(row.question_id)!).getTime() <= now,
    });
  }
  return out;
}

async function requirePublished(questionId: string) {
  const { data } = await admin().from("questions").select("id").eq("id", questionId).eq("status", "published").maybeSingle();
  if (!data) throw new AppError("not_found", "Questão indisponível.");
}

/** Gostei (1), não gostei (-1) ou tirar a avaliação (0). */
export async function rateQuestion(userId: string, questionId: string, vote: -1 | 0 | 1) {
  await enforceRateLimit(`rate:${userId}`, 60, 60);
  await requirePublished(questionId);
  const db = admin();
  if (vote === 0) {
    await db.from("question_feedback").delete().eq("user_id", userId).eq("question_id", questionId);
    return;
  }
  const { error } = await db.from("question_feedback").upsert({ user_id: userId, question_id: questionId, vote, created_at: new Date().toISOString() });
  if (error) throw error;
}

/** Marcar para rever: a questão entra na Revisão mesmo se a pessoa acertou. */
export async function setQuestionMark(userId: string, questionId: string, marked: boolean) {
  await enforceRateLimit(`mark:${userId}`, 60, 60);
  await requirePublished(questionId);
  const db = admin();
  if (!marked) {
    await db.from("question_marks").delete().eq("user_id", userId).eq("question_id", questionId);
    return;
  }
  const { error } = await db.from("question_marks").upsert({ user_id: userId, question_id: questionId });
  if (error) throw error;
  const { data: card } = await db.from("srs_cards").select("question_id").eq("user_id", userId).eq("question_id", questionId).maybeSingle();
  if (!card) {
    // Carta nova como se fosse um erro: volta logo na Revisão.
    const scheduled = scheduleCard(null, false, null);
    await db.from("srs_cards").insert({ user_id: userId, question_id: questionId, state: scheduled.state, due: scheduled.due });
  }
}

export type StudyState = { votes: Record<string, -1 | 1>; marked: string[] };

/** Avaliações e marcações da pessoa para um conjunto de questões. */
export async function getStudyState(userId: string, questionIds: string[]): Promise<StudyState> {
  if (!questionIds.length) return { votes: {}, marked: [] };
  const db = admin();
  const [{ data: votes }, { data: marks }] = await Promise.all([
    db.from("question_feedback").select("question_id, vote").eq("user_id", userId).in("question_id", questionIds),
    db.from("question_marks").select("question_id").eq("user_id", userId).in("question_id", questionIds),
  ]);
  return {
    votes: Object.fromEntries((votes ?? []).map((v: { question_id: string; vote: -1 | 1 }) => [v.question_id, v.vote])),
    marked: (marks ?? []).map((m: { question_id: string }) => m.question_id),
  };
}

/** Comentário de uma questão que a pessoa já respondeu (para rever na mesma rodada). */
export async function getRevealForAnswered(userId: string, questionId: string): Promise<Reveal> {
  const { count } = await admin().from("answers").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("question_id", questionId);
  if (!count) throw new AppError("not_found", "Responda a questão para ver o comentário.");
  return getReveal(questionId);
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
