import "server-only";
import { admin } from "@/lib/supabase/admin";
import { getPublicQuestions, PLAYABLE_LICENSES, type PublicQuestion } from "./questions";

export type PublicExam = {
  id: string;
  name: string;
  board: string;
  year: number;
  booklet: string | null;
  keyStatus: "preliminar" | "definitivo";
  valid: number;
  annulled: number;
};

/** Quantas questões abertas como amostra em cada prova, na página pública. */
export const PUBLIC_SAMPLE = 3;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function open(query: any) {
  return query.eq("status", "published").in("license", PLAYABLE_LICENSES);
}

/** Provas oficiais com questões disponíveis, da mais recente para a mais antiga. */
export async function listPublicExams(): Promise<PublicExam[]> {
  const db = admin();
  const [{ data: exams }, { data: questions }] = await Promise.all([
    db.from("official_exams").select("id, name, board, year, booklet, key_status").order("year", { ascending: false }),
    open(db.from("questions").select("official_exam_id, annulled").not("official_exam_id", "is", null)),
  ]);
  const count = new Map<string, { valid: number; annulled: number }>();
  for (const q of (questions ?? []) as { official_exam_id: string; annulled: boolean }[]) {
    const c = count.get(q.official_exam_id) ?? { valid: 0, annulled: 0 };
    if (q.annulled) c.annulled += 1;
    else c.valid += 1;
    count.set(q.official_exam_id, c);
  }
  return ((exams ?? []) as { id: string; name: string; board: string; year: number; booklet: string | null; key_status: "preliminar" | "definitivo" }[])
    .filter((e) => (count.get(e.id)?.valid ?? 0) > 0)
    .map((e) => ({
      id: e.id,
      name: e.name,
      board: e.board,
      year: e.year,
      booklet: e.booklet,
      keyStatus: e.key_status,
      valid: count.get(e.id)!.valid,
      annulled: count.get(e.id)!.annulled,
    }));
}

/** A prova e as primeiras questões válidas do caderno, sem gabarito nem comentário. */
export async function getPublicExam(examId: string): Promise<{ exam: PublicExam; sample: PublicQuestion[] } | null> {
  const exam = (await listPublicExams()).find((e) => e.id === examId);
  if (!exam) return null;
  const { data } = await open(admin().from("questions").select("id").eq("official_exam_id", examId).eq("annulled", false).is("outdated_note", null))
    .order("official_number")
    .limit(PUBLIC_SAMPLE);
  const ids = ((data ?? []) as { id: string }[]).map((q) => q.id);
  return { exam, sample: await getPublicQuestions(ids) };
}
