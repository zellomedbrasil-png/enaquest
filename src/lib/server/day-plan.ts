import "server-only";
import { admin } from "@/lib/supabase/admin";
import { todayBR } from "@/lib/game/streak";
import {
  buildDayPlan,
  clampMinutes,
  newQuestionQuotas,
  type DayBlockKind,
  type DayPlan,
  type DayPlanArea,
} from "@/lib/study/day-plan";
import { AppError, enforceRateLimit, getProfile, isPremium } from "./session";
import { getDailyIds, getDailyState } from "./daily";
import { getEvolution } from "./progress";
import { getPublicQuestions, PLAYABLE_LICENSES, type PublicQuestion } from "./questions";
import { pickByQuota, seededShuffle } from "./selection";
import { countDueReviews, getDueReviews } from "./study";

export type StudyGoals = { minutes: number; targetExam: "enamed" | "enare"; examDate: string | null };

export type DayView = {
  plan: DayPlan;
  premium: boolean;
  goals: StudyGoals & { set: boolean };
  areas: DayPlanArea[];
};

/** O dia no Brasil começa às 3h UTC (sem horário de verão). */
function startOfDayBR(day: string): string {
  return new Date(`${day}T03:00:00Z`).toISOString();
}

/** Contexto das respostas de cada bloco do Seu dia. */
export function dayContext(day: string, kind: "erros" | "novas"): string {
  return `dia:${day}:${kind}`;
}

type Pool = { id: string; area_id: string }[];

/** O que a pessoa ainda pode responder: questões novas e questões cuja última resposta foi errada. */
async function studyPools(userId: string, day: string): Promise<{ fresh: Pool; wrongNotDue: string[] }> {
  const db = admin();
  const [{ data: pool }, { data: history }, { data: cards }, dailyIds] = await Promise.all([
    db
      .from("questions")
      .select("id, area_id")
      .eq("status", "published")
      .in("license", PLAYABLE_LICENSES)
      .eq("annulled", false)
      .is("outdated_note", null),
    db.from("answers").select("question_id, is_correct, created_at").eq("user_id", userId).order("created_at"),
    db.from("srs_cards").select("question_id, due").eq("user_id", userId).lte("due", new Date().toISOString()),
    getDailyIds(day),
  ]);
  // As questões do Plantão de hoje ficam só no Plantão.
  const plantao = new Set(dailyIds);
  const last = new Map<string, boolean>();
  for (const row of history ?? []) last.set(row.question_id, row.is_correct);
  // Erros que já voltaram na revisão ficam no bloco de revisão, para não contar duas vezes.
  const dueNow = new Set((cards ?? []).map((c: { question_id: string }) => c.question_id));
  const playable = ((pool ?? []) as Pool).filter((q) => !plantao.has(q.id));
  return {
    fresh: playable.filter((q) => !last.has(q.id)),
    wrongNotDue: playable.filter((q) => last.get(q.id) === false && !dueNow.has(q.id)).map((q) => q.id),
  };
}

async function doneToday(userId: string, day: string) {
  const db = admin();
  const since = startOfDayBR(day);
  const count = (query: PromiseLike<{ count: number | null }>) => Promise.resolve(query).then((r) => r.count ?? 0);
  const [revisao, erros, novas] = await Promise.all([
    count(db.from("answers").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("mode", "review").gte("created_at", since)),
    count(db.from("answers").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("context", dayContext(day, "erros"))),
    count(db.from("answers").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("context", dayContext(day, "novas"))),
  ]);
  return { revisao, erros, novas };
}

async function planAreas(userId: string): Promise<DayPlanArea[]> {
  const [{ data: matrix }, evolution] = await Promise.all([
    admin().from("matrix_areas").select("id, name, color, exam_share").order("sort_order"),
    getEvolution(userId),
  ]);
  const byArea = new Map(evolution.areas.map((area) => [area.id, area]));
  return (matrix ?? []).map((area: { id: string; name: string; color: string; exam_share: number | string }) => ({
    id: area.id,
    name: area.name,
    color: area.color,
    share: Number(area.exam_share),
    pct: byArea.get(area.id)?.pct ?? null,
    n: byArea.get(area.id)?.n ?? 0,
  }));
}

export async function getDayView(userId: string): Promise<DayView> {
  const day = todayBR();
  const db = admin();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [profile, premium, daily, due, pools, done, areas, { count: simulados }] = await Promise.all([
    getProfile(userId),
    isPremium(userId),
    getDailyState(userId, day),
    countDueReviews(userId),
    studyPools(userId, day),
    doneToday(userId, day),
    planAreas(userId),
    db.from("simulado_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("finished_at", weekAgo),
  ]);

  const plan = buildDayPlan({
    today: day,
    minutes: profile.daily_minutes,
    examDate: profile.exam_date,
    plantao: { total: daily.questions.length, answered: Object.keys(daily.answered).length },
    dueReviews: due,
    errorsToRedo: pools.wrongNotDue.length,
    newAvailable: pools.fresh.length,
    areas,
    doneToday: done,
    simuladoThisWeek: (simulados ?? 0) > 0,
  });

  return {
    plan,
    premium,
    goals: { minutes: profile.daily_minutes, targetExam: profile.target_exam, examDate: profile.exam_date, set: profile.goals_set },
    areas,
  };
}

export type DayRound = { kind: DayBlockKind; mode: "training" | "review"; context: string; questions: PublicQuestion[] };

/** Começa (ou continua) um bloco do Seu dia com as questões que faltam nele. */
export async function startDayBlock(userId: string, kind: "revisao" | "erros" | "novas"): Promise<DayRound> {
  if (!(await isPremium(userId))) throw new AppError("premium_required", "Os blocos do Seu dia além do Plantão fazem parte da assinatura.");
  await enforceRateLimit(`day-block:${userId}`, 30, 3600);
  const day = todayBR();
  const view = await getDayView(userId);
  const block = view.plan.blocks.find((b) => b.kind === kind);
  const left = block ? Math.max(0, block.target - block.done) : 0;
  if (left === 0) return { kind, mode: kind === "revisao" ? "review" : "training", context: kind === "revisao" ? day : dayContext(day, kind), questions: [] };

  if (kind === "revisao") {
    const reviews = await getDueReviews(userId, left);
    return { kind, mode: "review", context: reviews.context, questions: reviews.questions };
  }

  const pools = await studyPools(userId, day);
  const context = dayContext(day, kind);
  const seed = `${userId}:${context}:${block?.done ?? 0}`;
  const ids =
    kind === "erros"
      ? seededShuffle(pools.wrongNotDue, seed).slice(0, left)
      : pickByQuota(pools.fresh, newQuestionQuotas(view.areas, left), seed, left);
  return { kind, mode: "training", context, questions: await getPublicQuestions(ids) };
}

export function isValidDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export async function saveStudyGoals(userId: string, goals: StudyGoals): Promise<void> {
  await enforceRateLimit(`goals:${userId}`, 30, 3600);
  if (goals.examDate !== null && (!isValidDay(goals.examDate) || goals.examDate < todayBR())) {
    throw new AppError("invalid", "Informe uma data de prova a partir de hoje.");
  }
  const { error } = await admin()
    .from("profiles")
    .update({ daily_minutes: clampMinutes(goals.minutes), target_exam: goals.targetExam, exam_date: goals.examDate, goals_set: true })
    .eq("id", userId);
  if (error) throw error;
}
