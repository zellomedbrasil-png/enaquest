import "server-only";
import { randomUUID } from "node:crypto";
import { admin } from "@/lib/supabase/admin";
import { AppError, enforceRateLimit, isPremium } from "./session";
import { getPublicQuestions, PLAYABLE_LICENSES, type PublicQuestion } from "./questions";

/** No plano grátis, cada prova oficial libera as primeiras questões como amostra. */
export const FREE_OFFICIAL_QUESTIONS = 10;

export type OfficialExamSummary = {
  id: string;
  name: string;
  board: string;
  year: number;
  booklet: string | null;
  keyStatus: "preliminar" | "definitivo";
  total: number;
  answered: number;
  correct: number;
};

/** Questões que podem ser resolvidas: publicadas, liberadas, válidas e atuais. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function playable(query: any) {
  return query.eq("status", "published").in("license", PLAYABLE_LICENSES).eq("annulled", false).is("outdated_note", null);
}

async function playableIds(examId: string): Promise<string[]> {
  const { data, error } = await playable(
    admin().from("questions").select("id, official_number").eq("official_exam_id", examId),
  ).order("official_number");
  if (error) throw error;
  return (data ?? []).map((row: { id: string }) => row.id);
}

/** Última resposta da pessoa em cada questão. */
async function lastAnswers(userId: string, ids: string[]): Promise<Map<string, boolean>> {
  const last = new Map<string, boolean>();
  if (!ids.length) return last;
  const { data } = await admin()
    .from("answers")
    .select("question_id, is_correct, created_at")
    .eq("user_id", userId)
    .in("question_id", ids)
    .order("created_at");
  for (const row of data ?? []) last.set(row.question_id, row.is_correct);
  return last;
}

/** Provas com pelo menos uma questão disponível, da mais recente para a mais antiga. */
export async function listOfficialExams(userId: string): Promise<OfficialExamSummary[]> {
  const db = admin();
  const [{ data: exams }, { data: questions }] = await Promise.all([
    db.from("official_exams").select("id, name, board, year, booklet, key_status").order("year", { ascending: false }).order("id"),
    playable(db.from("questions").select("id, official_exam_id").not("official_exam_id", "is", null)),
  ]);
  const byExam = new Map<string, string[]>();
  for (const q of (questions ?? []) as { id: string; official_exam_id: string }[]) {
    byExam.set(q.official_exam_id, [...(byExam.get(q.official_exam_id) ?? []), q.id]);
  }
  const last = await lastAnswers(userId, [...byExam.values()].flat());
  return (exams ?? [])
    .filter((exam: { id: string }) => byExam.has(exam.id))
    .map((exam: { id: string; name: string; board: string; year: number; booklet: string | null; key_status: "preliminar" | "definitivo" }) => {
      const ids = byExam.get(exam.id) ?? [];
      const answered = ids.filter((id) => last.has(id));
      return {
        id: exam.id,
        name: exam.name,
        board: exam.board,
        year: exam.year,
        booklet: exam.booklet,
        keyStatus: exam.key_status,
        total: ids.length,
        answered: answered.length,
        correct: answered.filter((id) => last.get(id)).length,
      };
    });
}

/**
 * Próximo bloco da prova, na ordem do caderno, a partir da primeira questão ainda não respondida.
 * Grátis: só as primeiras questões da prova. Respondeu todas: recomeça do início.
 */
export async function startOfficialRound(
  userId: string,
  examId: string,
  size: number,
): Promise<{ context: string; questions: PublicQuestion[]; sampleOnly: boolean }> {
  await enforceRateLimit(`official:${userId}`, 30, 3600);
  const premium = await isPremium(userId);
  let ids = await playableIds(examId);
  if (!ids.length) throw new AppError("not_found", "Essa prova ainda não tem questões disponíveis.");
  if (!premium) ids = ids.slice(0, FREE_OFFICIAL_QUESTIONS);

  const last = await lastAnswers(userId, ids);
  const firstOpen = ids.findIndex((id) => !last.has(id));
  const start = firstOpen === -1 ? 0 : firstOpen;
  const take = Math.min(Math.max(size, 5), 100);
  const chosen = ids.slice(start, start + take);
  return { context: randomUUID(), questions: await getPublicQuestions(chosen), sampleOnly: !premium };
}
