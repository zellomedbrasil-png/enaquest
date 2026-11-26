import { toPublicQuestion } from "./questions";
import "server-only";
import { admin } from "@/lib/supabase/admin";
import { AppError } from "./session";

export type InboxQuestion = {
  id: string;
  slug: string;
  theme: string;
  area_id: string;
  status: string;
  risk_level: string;
  hold_reason: string | null;
  lot_id: string | null;
  official_number: number | null;
  annulled: boolean;
  stem: string;
  exams: { title: string; rows: string[][] }[] | null;
  options: string[];
  images: ReturnType<typeof toPublicQuestion>["images"];
  key: number | null;
  quick: string | null;
  sources: { title: string; url: string; publisher: string; year: number; locator: string | null }[];
};

const INBOX_FIELDS = "id, slug, theme, area_id, status, risk_level, hold_reason, lot_id, official_number, annulled, stem, options, images, exams";

/**
 * Caixa de exceções: só o que precisa de decisão humana.
 * - "attention": importadas fora do ar (dúvida nas checagens ou importadas sem publicar);
 * - "quarantined": tiradas do ar pelos alunos (denúncias) ou pela estatística;
 * - "unreviewed": no ar só com a checagem da IA, para a revisão médica opcional.
 */
export async function getInbox() {
  const db = admin();
  const [attention, quarantined, unreviewed, { count: published }, { count: reviewed }] = await Promise.all([
    db.from("questions").select(INBOX_FIELDS, { count: "exact" }).in("status", ["draft", "in_review"]).order("created_at", { ascending: false }).limit(100),
    db.from("questions").select(INBOX_FIELDS, { count: "exact" }).eq("status", "quarantined").order("created_at", { ascending: false }).limit(100),
    db
      .from("questions")
      .select(INBOX_FIELDS, { count: "exact" })
      .eq("status", "published")
      .eq("verification", "ia_verificada")
      .is("official_exam_id", null)
      .order("risk_level")
      .order("published_at", { ascending: false })
      .limit(30),
    db.from("questions").select("id", { count: "exact", head: true }).eq("status", "published"),
    db.from("questions").select("id", { count: "exact", head: true }).eq("status", "published").eq("verification", "medico_revisado"),
  ]);
  for (const result of [attention, quarantined, unreviewed]) if (result.error) throw result.error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = [...(attention.data ?? []), ...(quarantined.data ?? []), ...(unreviewed.data ?? [])] as any[];
  const ids = all.map((q) => q.id);
  const [{ data: keys }, { data: explanations }, { data: sources }] = ids.length
    ? await Promise.all([
        db.from("question_keys").select("question_id, correct_index").in("question_id", ids),
        db.from("explanations").select("question_id, quick").in("question_id", ids),
        db.from("question_sources").select("question_id, locator, sources(title, publisher, year, url)").in("question_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shape = (rows: any[] | null): InboxQuestion[] =>
    (rows ?? []).map((q) => ({
      ...q,
      images: toPublicQuestion(q).images,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      key: (keys ?? []).find((k: any) => k.question_id === q.id)?.correct_index ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quick: (explanations ?? []).find((e: any) => e.question_id === q.id)?.quick ?? null,
      sources: (sources ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((s: any) => s.question_id === q.id && s.sources)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((s: any) => ({ ...s.sources, locator: s.locator })),
    }));

  return {
    attention: shape(attention.data),
    quarantined: shape(quarantined.data),
    unreviewed: shape(unreviewed.data),
    counts: {
      published: published ?? 0,
      reviewed: reviewed ?? 0,
      attention: attention.count ?? 0,
      quarantined: quarantined.count ?? 0,
      unreviewed: unreviewed.count ?? 0,
    },
  };
}

/** Coloca no ar uma questão que estava fora (precisa de olho ou quarentena). */
export async function publishQuestion(id: string) {
  const db = admin();
  const { data } = await db.from("questions").select("published_at").eq("id", id).maybeSingle();
  if (!data) throw new AppError("not_found", "Questão não encontrada.");
  await db
    .from("questions")
    .update({ status: "published", hold_reason: null, published_at: data.published_at ?? new Date().toISOString() })
    .eq("id", id);
  // Denúncias abertas já foram consideradas por quem republicou.
  await db.from("reports").update({ status: "resolvida" }).eq("question_id", id).eq("status", "aberta");
}

export async function retireQuestion(id: string, reason: string) {
  await admin().from("questions").update({ status: "retired", hold_reason: reason }).eq("id", id);
}

/** Revisão médica opcional: só quem leu a questão inteira deve marcar. */
export async function markReviewed(reviewerId: string, id: string) {
  const { data } = await admin()
    .from("questions")
    .update({ verification: "medico_revisado", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (!data?.length) throw new AppError("not_found", "Questão não encontrada.");
}

export async function getModerationQueue() {
  const db = admin();
  const [reports, appeals, comments] = await Promise.all([
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
  ]);
  for (const result of [reports, appeals, comments]) {
    if (result.error) throw result.error;
  }
  return { reports: reports.data ?? [], appeals: appeals.data ?? [], comments: comments.data ?? [] };
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
