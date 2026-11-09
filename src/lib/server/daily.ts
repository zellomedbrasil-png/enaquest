import "server-only";
import { admin } from "@/lib/supabase/admin";
import { getPublicQuestions, type PublicQuestion } from "./questions";
import { pickDaily } from "./selection";

export const DAILY_SIZE = 10;

/** As mesmas questões para todos, sorteadas uma vez por dia. */
export async function getDailyIds(day: string): Promise<string[]> {
  const db = admin();
  const { data: existing } = await db.from("daily_challenges").select("question_ids").eq("day", day).maybeSingle();
  if (existing) return existing.question_ids;

  const { data: pool } = await db.from("questions").select("id, area_id").eq("status", "published").eq("license", "proprio");
  if (!pool?.length) return [];
  const { data: areas } = await db.from("matrix_areas").select("id, exam_share");
  const ids = pickDaily(pool, areas ?? [], day, DAILY_SIZE);
  await db.from("daily_challenges").insert({ day, question_ids: ids });

  // Outra requisição pode ter sorteado ao mesmo tempo: vale o que ficou gravado.
  const { data: saved } = await db.from("daily_challenges").select("question_ids").eq("day", day).single();
  return saved.question_ids;
}

export type DailyState = {
  day: string;
  questions: PublicQuestion[];
  answered: Record<string, { selected: number; correct: boolean }>;
  done: boolean;
};

export async function getDailyState(userId: string, day: string): Promise<DailyState> {
  const ids = await getDailyIds(day);
  const questions = await getPublicQuestions(ids);
  const { data } = await admin()
    .from("answers")
    .select("question_id, selected, is_correct")
    .eq("user_id", userId)
    .eq("mode", "daily")
    .eq("context", day);
  const answered: DailyState["answered"] = {};
  for (const row of data ?? []) answered[row.question_id] = { selected: row.selected, correct: row.is_correct };
  return { day, questions, answered, done: questions.length > 0 && Object.keys(answered).length >= questions.length };
}

export type DailyBoard = {
  rows: { nickname: string; school: string | null; correct: number; minutes: number; me: boolean }[];
  total: number;
  percentile: number | null;
};

export async function getDailyBoard(userId: string, day: string): Promise<DailyBoard> {
  const ids = await getDailyIds(day);
  const { data } = await admin().rpc("daily_leaderboard", { p_day: day, p_total: ids.length || 1 });
  const all = (data ?? []) as { user_id: string; nickname: string; school: string | null; correct: number; total_ms: number }[];
  const position = all.findIndex((row) => row.user_id === userId);
  const below = position >= 0 ? all.filter((r) => Number(r.correct) < Number(all[position].correct)).length : 0;
  return {
    rows: all.slice(0, 20).map((row) => ({
      nickname: row.nickname,
      school: row.school,
      correct: Number(row.correct),
      minutes: Math.round(Number(row.total_ms) / 60000),
      me: row.user_id === userId,
    })),
    total: all.length,
    percentile: position >= 0 && all.length >= 5 ? Math.round((below / all.length) * 100) : null,
  };
}
