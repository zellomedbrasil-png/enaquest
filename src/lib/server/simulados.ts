import "server-only";
import { admin } from "@/lib/supabase/admin";
import { xpForSimulado } from "@/lib/game/xp";
import { scheduleCard } from "@/lib/study/srs";
import { AppError, isPremium } from "./session";
import { getPublicQuestions, getReveal, type PublicQuestion, type Reveal } from "./questions";
import { grantAchievements } from "./progress";

export type SimuladoSummary = {
  id: string;
  title: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  questionCount: number;
  isOpen: boolean;
  attempt: { id: string; finishedAt: string | null; correct: number | null; total: number | null; deadline: string } | null;
};

export async function listSimulados(userId: string): Promise<SimuladoSummary[]> {
  const db = admin();
  const { data: rows } = await db
    .from("simulados")
    .select("id, title, opens_at, closes_at, duration_minutes, question_ids")
    .eq("published", true)
    .order("opens_at", { ascending: false });
  const { data: attempts } = await db
    .from("simulado_attempts")
    .select("id, simulado_id, finished_at, correct, total, deadline")
    .eq("user_id", userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows ?? []).map((row: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attempt = (attempts ?? []).find((a: any) => a.simulado_id === row.id);
    return {
      id: row.id,
      title: row.title,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      durationMinutes: row.duration_minutes,
      questionCount: row.question_ids.length,
      isOpen: Date.now() >= new Date(row.opens_at).getTime() && Date.now() <= new Date(row.closes_at).getTime(),
      attempt: attempt
        ? { id: attempt.id, finishedAt: attempt.finished_at, correct: attempt.correct, total: attempt.total, deadline: attempt.deadline }
        : null,
    };
  });
}

export type AttemptState = {
  attemptId: string;
  simuladoId: string;
  title: string;
  deadline: string;
  questions: PublicQuestion[];
  answers: Record<string, number>;
  flags: string[];
  finished: boolean;
};

export async function startOrResumeSimulado(userId: string, simuladoId: string): Promise<AttemptState> {
  if (!(await isPremium(userId))) throw new AppError("premium_required", "Os simulados fazem parte da assinatura.");
  const db = admin();
  const { data: simulado } = await db.from("simulados").select("*").eq("id", simuladoId).eq("published", true).single();
  if (!simulado) throw new AppError("not_found", "Simulado não encontrado.");

  let { data: attempt } = await db.from("simulado_attempts").select("*").eq("simulado_id", simuladoId).eq("user_id", userId).maybeSingle();
  if (!attempt) {
    const now = Date.now();
    if (now < new Date(simulado.opens_at).getTime() || now > new Date(simulado.closes_at).getTime()) {
      throw new AppError("closed", "Este simulado está fora da janela de aplicação.");
    }
    const deadline = new Date(now + simulado.duration_minutes * 60_000).toISOString();
    await db.from("simulado_attempts").insert({ simulado_id: simuladoId, user_id: userId, deadline }).select().maybeSingle();
    // Dois cliques ao mesmo tempo: a restrição única garante uma tentativa só.
    ({ data: attempt } = await db.from("simulado_attempts").select("*").eq("simulado_id", simuladoId).eq("user_id", userId).single());
  }

  // Tempo esgotado com a página fechada: encerra com o que foi marcado.
  if (!attempt.finished_at && new Date(attempt.deadline).getTime() < Date.now()) {
    await finishSimulado(userId, attempt.id);
    attempt.finished_at = new Date().toISOString();
  }

  return {
    attemptId: attempt.id,
    simuladoId,
    title: simulado.title,
    deadline: attempt.deadline,
    questions: await getPublicQuestions(simulado.question_ids, { publishedOnly: false }),
    answers: attempt.answers ?? {},
    flags: attempt.flags ?? [],
    finished: Boolean(attempt.finished_at),
  };
}

export async function saveSimuladoProgress(
  userId: string,
  attemptId: string,
  progress: { answers: Record<string, number>; flags: string[] },
) {
  const db = admin();
  const { data: attempt } = await db
    .from("simulado_attempts")
    .select("id, deadline, finished_at")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .single();
  if (!attempt) throw new AppError("not_found", "Tentativa não encontrada.");
  if (attempt.finished_at) throw new AppError("closed", "Este simulado já foi encerrado.");
  // Pequena folga para a última gravação em trânsito.
  if (new Date(attempt.deadline).getTime() + 30_000 < Date.now()) throw new AppError("closed", "O tempo do simulado acabou.");
  await db.from("simulado_attempts").update({ answers: progress.answers, flags: progress.flags }).eq("id", attemptId);
}

export async function finishSimulado(userId: string, attemptId: string) {
  const db = admin();
  const { data: attempt } = await db.from("simulado_attempts").select("*").eq("id", attemptId).eq("user_id", userId).single();
  if (!attempt) throw new AppError("not_found", "Tentativa não encontrada.");
  if (attempt.finished_at) return;
  const { data: simulado } = await db.from("simulados").select("question_ids").eq("id", attempt.simulado_id).single();
  const ids: string[] = simulado.question_ids;
  const { data: keys } = await db.from("question_keys").select("question_id, correct_index").in("question_id", ids);
  const keyOf = new Map<string, number>((keys ?? []).map((k: { question_id: string; correct_index: number }) => [k.question_id, k.correct_index]));

  const marked: Record<string, number> = attempt.answers ?? {};
  const rows = ids
    .filter((id) => typeof marked[id] === "number")
    .map((id) => ({ question_id: id, selected: marked[id], is_correct: keyOf.get(id) === marked[id] }));
  const correct = rows.filter((r) => r.is_correct).length;

  // Tudo que errou no simulado vai para a revisão espaçada.
  const srsRows: Record<string, unknown> = {};
  for (const row of rows) if (!row.is_correct) srsRows[row.question_id] = scheduleCard(null, false, null);

  await db.rpc("finish_simulado", {
    p: {
      attempt_id: attemptId,
      user_id: userId,
      correct,
      total: ids.length,
      rows,
      srs_due_rows: srsRows,
      xp: xpForSimulado(correct),
    },
  });
  await grantAchievements(userId);
}

export type SimuladoResult = {
  title: string;
  correct: number;
  total: number;
  answered: number;
  percentile: number | null;
  participants: number;
  byArea: { id: string; name: string; color: string; correct: number; total: number; share: number }[];
  ranking: { nickname: string; school: string | null; correct: number; me: boolean }[];
  items: { question: PublicQuestion; selected: number | null; reveal: Reveal }[];
};

export async function getSimuladoResult(userId: string, simuladoId: string): Promise<SimuladoResult | null> {
  const db = admin();
  const { data: attempt } = await db.from("simulado_attempts").select("*").eq("simulado_id", simuladoId).eq("user_id", userId).maybeSingle();
  if (!attempt?.finished_at) return null;
  const { data: simulado } = await db.from("simulados").select("title, question_ids").eq("id", simuladoId).single();
  const questions = await getPublicQuestions(simulado.question_ids, { publishedOnly: false });
  const reveals = await Promise.all(questions.map((q) => getReveal(q.id)));
  const marked: Record<string, number> = attempt.answers ?? {};
  const { data: areas } = await db.from("matrix_areas").select("id, name, color, exam_share, sort_order").order("sort_order");
  const { data: board } = await db.rpc("simulado_leaderboard", { p_simulado: simuladoId });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = (board ?? []) as any[];
  const below = all.filter((r) => r.correct < attempt.correct).length;

  const items = questions.map((question, i) => ({
    question,
    selected: typeof marked[question.id] === "number" ? marked[question.id] : null,
    reveal: reveals[i],
  }));

  return {
    title: simulado.title,
    correct: attempt.correct,
    total: attempt.total,
    answered: Object.keys(marked).length,
    percentile: all.length >= 5 ? Math.round((below / all.length) * 100) : null,
    participants: all.length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    byArea: (areas ?? []).map((area: any) => {
      const inArea = items.filter((item) => item.question.areaId === area.id);
      return {
        id: area.id,
        name: area.name,
        color: area.color,
        share: Number(area.exam_share),
        total: inArea.length,
        correct: inArea.filter((item) => item.selected === item.reveal.correctIndex).length,
      };
    }),
    ranking: all.slice(0, 20).map((row) => ({ nickname: row.nickname, school: row.school, correct: row.correct, me: row.user_id === userId })),
    items,
  };
}
