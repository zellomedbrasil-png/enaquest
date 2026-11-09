import "server-only";
import { admin } from "@/lib/supabase/admin";
import { AppError } from "./session";
import { pickReviewSample } from "./selection";

export async function listLots() {
  const db = admin();
  const { data: lots } = await db.from("review_lots").select("*").order("created_at", { ascending: false });
  const { data: questions } = await db.from("questions").select("lot_id, status");
  const { data: samples } = await db.from("review_samples").select("lot_id, decision");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (lots ?? []).map((lot: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mine = (samples ?? []).filter((s: any) => s.lot_id === lot.id);
    return {
      ...lot,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      questionCount: (questions ?? []).filter((q: any) => q.lot_id === lot.id).length,
      sampled: mine.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      decided: mine.filter((s: any) => s.decision).length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      critical: mine.filter((s: any) => s.decision === "critical").length,
    };
  });
}

/** Sorteia a amostra uma única vez, para ela não mudar depois de começar a revisar. */
async function ensureSample(lotId: string, sampleSize: number) {
  const db = admin();
  const { count } = await db.from("review_samples").select("question_id", { count: "exact", head: true }).eq("lot_id", lotId);
  if (count) return;
  const { data: questions } = await db.from("questions").select("id, risk_level").eq("lot_id", lotId);
  const ids = pickReviewSample(questions ?? [], `${lotId}:${Date.now()}`, sampleSize);
  await db.from("review_samples").insert(ids.map((question_id) => ({ lot_id: lotId, question_id })));
}

export async function getLotReview(lotId: string) {
  const db = admin();
  const { data: lot } = await db.from("review_lots").select("*").eq("id", lotId).single();
  if (!lot) throw new AppError("not_found", "Lote não encontrado.");
  await ensureSample(lotId, lot.sample_size);
  const { data: samples } = await db.from("review_samples").select("*").eq("lot_id", lotId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids = (samples ?? []).map((s: any) => s.question_id);
  const [{ data: questions }, { data: keys }, { data: explanations }, { data: sources }, { count: total }] = await Promise.all([
    db.from("questions").select("*").in("id", ids),
    db.from("question_keys").select("*").in("question_id", ids),
    db.from("explanations").select("*").in("question_id", ids),
    db.from("question_sources").select("question_id, locator, sources(title, publisher, year, url)").in("question_id", ids),
    db.from("questions").select("id", { count: "exact", head: true }).eq("lot_id", lotId),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (questions ?? []).map((question: any) => ({
    question,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    key: (keys ?? []).find((k: any) => k.question_id === question.id)?.correct_index,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    explanation: (explanations ?? []).find((e: any) => e.question_id === question.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sources: (sources ?? []).filter((s: any) => s.question_id === question.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sample: (samples ?? []).find((s: any) => s.question_id === question.id),
  }));
  // Primeiro as pendentes, depois alto risco.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items.sort((a: any, b: any) => Number(Boolean(a.sample.decision)) - Number(Boolean(b.sample.decision)) || (a.question.risk_level === "alto" ? -1 : 1));
  return { lot, items, total: total ?? 0 };
}

export async function decideSample(
  reviewerId: string,
  input: { lotId: string; questionId: string; decision: "ok" | "minor" | "critical"; notes?: string | null },
) {
  const db = admin();
  const { data: lot } = await db.from("review_lots").select("status").eq("id", input.lotId).single();
  if (!lot || lot.status === "approved") throw new AppError("closed", "Este lote já foi decidido.");
  await db
    .from("review_samples")
    .update({ decision: input.decision, notes: input.notes ?? null, reviewer_id: reviewerId, decided_at: new Date().toISOString() })
    .eq("lot_id", input.lotId)
    .eq("question_id", input.questionId);

  // Erro crítico segura o lote inteiro até achar a causa.
  if (input.decision === "critical") {
    await db
      .from("review_lots")
      .update({ status: "held", held_reason: input.notes ?? "Erro crítico na amostra" })
      .eq("id", input.lotId);
  }
}

export async function approveLot(reviewerId: string, lotId: string) {
  const db = admin();
  const { data: samples } = await db.from("review_samples").select("question_id, decision").eq("lot_id", lotId);
  const rows = (samples ?? []) as { question_id: string; decision: string | null }[];
  if (!rows.length || rows.some((s) => !s.decision)) throw new AppError("invalid", "Ainda há questões da amostra sem decisão.");
  if (rows.some((s) => s.decision === "critical")) throw new AppError("invalid", "A amostra tem erro crítico. O lote não pode ser aprovado.");

  const now = new Date().toISOString();
  await db.from("review_lots").update({ status: "approved", decided_by: reviewerId, decided_at: now }).eq("id", lotId);
  await db
    .from("questions")
    .update({ status: "published", verification: "lote_amostrado", published_at: now })
    .eq("lot_id", lotId)
    .in("status", ["draft", "in_review"]);
  // Só recebe o selo de revisada a questão que um médico realmente leu e aprovou sem ressalva.
  const read = rows.filter((s) => s.decision === "ok").map((s) => s.question_id);
  if (read.length) await db.from("questions").update({ verification: "medico_revisado" }).in("id", read);
  // Questão com ressalva não vai ao ar até ser corrigida.
  const minor = rows.filter((s) => s.decision === "minor").map((s) => s.question_id);
  if (minor.length) await db.from("questions").update({ status: "in_review", published_at: null }).in("id", minor);
}

export async function rejectLot(reviewerId: string, lotId: string, reason: string) {
  const db = admin();
  await db
    .from("review_lots")
    .update({ status: "rejected", held_reason: reason, decided_by: reviewerId, decided_at: new Date().toISOString() })
    .eq("id", lotId);
  await db.from("questions").update({ status: "retired" }).eq("lot_id", lotId).neq("status", "published");
}

export async function getModerationQueue() {
  const db = admin();
  const [reports, appeals, comments, quarantined] = await Promise.all([
    db
      .from("reports")
      .select("id, kind, body, created_at, question_id, comment_id, profiles(nickname), questions(slug, theme), comments(body)")
      .eq("status", "aberta")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("appeals")
      .select("id, argument, created_at, question_id, profiles!appeals_user_id_fkey(nickname), questions(slug, theme, stem, options)")
      .eq("status", "aberto")
      .order("created_at")
      .limit(50),
    db
      .from("comments")
      .select("id, body, votes, pinned, hidden, created_at, profiles!comments_user_id_fkey(nickname), questions(slug, theme)")
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("questions").select("id, slug, theme, area_id").eq("status", "quarantined").limit(100),
  ]);
  for (const result of [reports, appeals, comments, quarantined]) {
    if (result.error) throw result.error;
  }
  return { reports: reports.data ?? [], appeals: appeals.data ?? [], comments: comments.data ?? [], quarantined: quarantined.data ?? [] };
}

export async function resolveReport(id: string, status: "resolvida" | "descartada") {
  await admin().from("reports").update({ status }).eq("id", id);
}

export async function decideAppeal(editorId: string, id: string, status: "deferido" | "indeferido", note: string) {
  await admin()
    .from("appeals")
    .update({ status, decision_note: note, decided_by: editorId, decided_at: new Date().toISOString() })
    .eq("id", id);
}

export async function moderateComment(id: string, patch: { hidden?: boolean; pinned?: boolean }) {
  await admin().from("comments").update(patch).eq("id", id);
}

export async function setQuestionStatus(id: string, status: "published" | "quarantined" | "retired") {
  await admin().from("questions").update({ status }).eq("id", id);
}
