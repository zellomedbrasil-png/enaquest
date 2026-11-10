import "server-only";
import { admin } from "@/lib/supabase/admin";
import { countDueReviews } from "./study";
import { addDays, todayBR } from "@/lib/game/streak";
import { XP } from "@/lib/game/xp";
import { missionsFor, unlockedAchievements, type LifetimeStats, type Mission } from "@/lib/game/progress";
import { proficiency, type Calibration, type ProficiencyEstimate } from "@/lib/study/proficiency";
import { MIN_AREA_RESPONSES } from "@/lib/study/proficiency";

export async function lifetimeStats(userId: string): Promise<LifetimeStats> {
  const db = admin();
  const count = (build: (q: ReturnType<typeof base>) => unknown) => build(base());
  const base = () => db.from("answers").select("id", { count: "exact", head: true }).eq("user_id", userId);

  const [answered, correct, reviews, diagnosed, rating, streak, simulados, perfect, commentRows] = await Promise.all([
    count((q) => q),
    count((q) => q.eq("is_correct", true)),
    count((q) => q.eq("mode", "review")),
    count((q) => q.not("error_reason", "is", null)),
    db.from("rating_state").select("rating, best_combo").eq("user_id", userId).single(),
    db.from("streaks").select("best").eq("user_id", userId).single(),
    db.from("simulado_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId).not("finished_at", "is", null),
    db.from("xp_ledger").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", "daily_perfect"),
    db.from("comments").select("votes").eq("user_id", userId),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = (r: any) => r.count ?? 0;
  return {
    answered: n(answered),
    correct: n(correct),
    reviews: n(reviews),
    diagnosed: n(diagnosed),
    rating: Number(rating.data?.rating ?? 0),
    bestCombo: rating.data?.best_combo ?? 0,
    bestStreak: streak.data?.best ?? 0,
    simulados: n(simulados),
    dailyPerfect: n(perfect),
    comments: commentRows.data?.length ?? 0,
    commentVotes: (commentRows.data ?? []).reduce((sum: number, c: { votes: number }) => sum + c.votes, 0),
  };
}

export async function grantAchievements(userId: string): Promise<string[]> {
  const db = admin();
  const [{ data: owned }, stats] = await Promise.all([
    db.from("achievements").select("achievement_id").eq("user_id", userId),
    lifetimeStats(userId),
  ]);
  const already = new Set<string>((owned ?? []).map((a: { achievement_id: string }) => a.achievement_id));
  const fresh = unlockedAchievements(stats, already);
  for (const id of fresh) {
    await db.from("achievements").insert({ user_id: userId, achievement_id: id });
    await db.rpc("award_xp", { p_user: userId, p_amount: XP.achievement, p_kind: "achievement", p_ref: id });
  }
  return fresh;
}

function startOfTodayBR(): string {
  return `${todayBR()}T00:00:00-03:00`;
}

export async function todayMissions(userId: string): Promise<Mission[]> {
  const db = admin();
  const day = todayBR();
  const { data } = await db
    .from("answers")
    .select("is_correct, mode, context, error_reason, questions(area_id)")
    .eq("user_id", userId)
    .gte("created_at", startOfTodayBR());
  const rows = data ?? [];
  const { data: finished } = await db
    .from("xp_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "daily_complete")
    .eq("ref", day)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typed = rows as any[];
  return missionsFor(day, {
    answered: typed.length,
    correct: typed.filter((r) => r.is_correct).length,
    reviews: typed.filter((r) => r.mode === "review").length,
    diagnosed: typed.filter((r) => r.error_reason).length,
    areasTouched: new Set(typed.map((r) => r.questions?.area_id)).size,
    dailyDone: Boolean(finished),
  });
}

/** Os últimos 7 dias (o último é hoje) e se o jogador respondeu algo em cada um. */
export async function weekActivity(userId: string): Promise<{ day: string; active: boolean }[]> {
  const today = todayBR();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const { data } = await admin()
    .from("answers")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", `${days[0]}T00:00:00-03:00`)
    .limit(5000);
  const active = new Set((data ?? []).map((row: { created_at: string }) => todayBR(new Date(row.created_at))));
  return days.map((day) => ({ day, active: active.has(day) }));
}

export type AreaPerformance = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  n: number;
  correct: number;
  pct: number | null;
  estimate: ProficiencyEstimate | null;
};

export type Evolution = {
  overall: ProficiencyEstimate;
  calibrated: boolean;
  areas: AreaPerformance[];
  history: { day: string; rating: number }[];
  errorReasons: { reason: string; count: number }[];
  confidence: { level: string; n: number; correct: number }[];
  totalAnswered: number;
  dueReviews: number;
};

export async function getEvolution(userId: string): Promise<Evolution> {
  const db = admin();
  const [{ data: rows }, { data: areas }, { data: config }, { data: state }, due] = await Promise.all([
    db
      .from("answers")
      .select("is_correct, confidence, error_reason, rating_delta, created_at, mode, questions(area_id, rating)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(5000),
    db.from("matrix_areas").select("*").order("sort_order"),
    db.from("app_config").select("value").eq("key", "proficiency_calibration").single(),
    db.from("rating_state").select("rating").eq("user_id", userId).single(),
    countDueReviews(userId),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const answers = (rows ?? []) as any[];
  const calibration: Calibration = config?.value ?? { calibrated: false };
  // Revisões repetem questões já vistas e distorceriam a estimativa.
  const measured = answers.filter((a) => a.mode !== "review");
  const toResponse = (a: (typeof answers)[number]) => ({ itemRating: Number(a.questions?.rating ?? 1300), correct: a.is_correct });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const areaRows: AreaPerformance[] = (areas ?? []).map((area: any) => {
    const mine = measured.filter((a) => a.questions?.area_id === area.id);
    const hits = mine.filter((a) => a.is_correct).length;
    return {
      id: area.id,
      name: area.name,
      shortName: area.short_name,
      color: area.color,
      n: mine.length,
      correct: hits,
      pct: mine.length >= MIN_AREA_RESPONSES ? Math.round((hits / mine.length) * 100) : null,
      estimate: null,
    };
  });

  const reasons = new Map<string, number>();
  for (const a of answers) if (a.error_reason) reasons.set(a.error_reason, (reasons.get(a.error_reason) ?? 0) + 1);

  const levels = ["certeza", "duvida", "chute"].map((level) => {
    const mine = measured.filter((a) => a.confidence === level);
    return { level, n: mine.length, correct: mine.filter((a) => a.is_correct).length };
  });

  let running = Number(state?.rating ?? 900) - answers.reduce((sum, a) => sum + Number(a.rating_delta ?? 0), 0);
  const byDay = new Map<string, number>();
  for (const a of answers) {
    running += Number(a.rating_delta ?? 0);
    byDay.set(todayBR(new Date(a.created_at)), Math.round(running));
  }

  return {
    overall: proficiency(measured.map(toResponse), calibration),
    calibrated: Boolean(calibration.calibrated),
    areas: areaRows,
    history: [...byDay.entries()].map(([day, rating]) => ({ day, rating })).slice(-60),
    errorReasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    confidence: levels,
    totalAnswered: answers.length,
    dueReviews: due,
  };
}
