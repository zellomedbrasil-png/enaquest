// Grava um lote no banco. Com publish, cada questão sem hold_reason já vai ao ar.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lot, LotQuestion } from "../pipeline/schema";
import { DIFFICULTY_RATING } from "../../src/lib/game/rating";

export type ImportSummary = { published: number; held: number; drafts: number; keptRetired: number; reviewKept: number };

type Existing = {
  id: string;
  status: string;
  verification: string;
  published_at: string | null;
  stem: string;
  options: string[];
  exams: unknown;
  question_keys: { correct_index: number | null } | null;
};

/** O que o aluno vê mudou? Se mudou, a revisão médica anterior não vale mais. */
function contentChanged(old: Existing, q: LotQuestion, key: number | null): boolean {
  return (
    old.stem !== q.stem ||
    JSON.stringify(old.options) !== JSON.stringify(q.options) ||
    JSON.stringify(old.exams ?? null) !== JSON.stringify(q.exams ?? null) ||
    (old.question_keys?.correct_index ?? null) !== key
  );
}

export async function importLot(db: SupabaseClient, lot: Lot, options: { publish: boolean }): Promise<ImportSummary> {
  const check = async <T extends { error: { message: string } | null }>(result: PromiseLike<T>) => {
    const value = await result;
    if (value.error) throw new Error(value.error.message);
    return value;
  };
  const summary: ImportSummary = { published: 0, held: 0, drafts: 0, keptRetired: 0, reviewKept: 0 };
  const now = new Date().toISOString();

  const exam = lot.official_exam;
  if (exam) {
    await check(
      db.from("official_exams").upsert({
        id: exam.id,
        track_id: exam.track_id,
        board: exam.board,
        name: exam.name,
        year: exam.year,
        booklet: exam.booklet ?? null,
        applied_on: exam.applied_on ?? null,
        key_status: exam.key_status,
        booklet_url: exam.booklet_url ?? null,
        key_url: exam.key_url ?? null,
      }),
    );
  }

  for (const image of lot.questions.flatMap((q) => q.images ?? [])) {
    if (/^https?:\/\//.test(image.src)) continue;
    const file = join("content", "media", image.src);
    if (!existsSync(file)) throw new Error(`Figura não encontrada: ${file}`);
    const type = image.src.endsWith(".png") ? "image/png" : "image/jpeg";
    const { error } = await db.storage.from("question-media").upload(image.src, readFileSync(file), { upsert: true, contentType: type });
    if (error) throw new Error(`Falha ao enviar ${image.src}: ${error.message}`);
  }

  await check(db.from("sources").upsert(lot.sources));
  await check(
    db.from("review_lots").upsert({
      id: lot.id,
      notes: lot.notes ?? null,
      status: options.publish ? "approved" : "pending_review",
      decided_at: options.publish ? now : null,
    }),
  );

  for (const q of lot.questions) {
    // Anulada: sem gabarito válido. O preliminar fica só no JSON do lote, para registro.
    const key = q.official?.annulled ? null : q.correct_index;
    const { data: found } = await check(
      db.from("questions").select("id, status, verification, published_at, stem, options, exams, question_keys(correct_index)").eq("slug", q.slug).maybeSingle(),
    );
    const old = found as unknown as Existing | null;
    const changed = !old || contentChanged(old, q, key);

    let status: string;
    if (old?.status === "retired" && !changed) {
      // Retirada à mão e reimportada sem mudança: continua fora.
      status = "retired";
      summary.keptRetired += 1;
    } else if (!options.publish) {
      status = "in_review";
      summary.drafts += 1;
    } else if (q.hold_reason) {
      status = "in_review";
      summary.held += 1;
    } else {
      status = "published";
      summary.published += 1;
    }

    const keepReview = !changed && old?.verification === "medico_revisado";
    if (keepReview) summary.reviewKept += 1;

    const { data } = await check(
      db
        .from("questions")
        .upsert(
          {
            slug: q.slug,
            track_id: exam?.track_id ?? "enamed",
            area_id: q.area_id,
            competency_id: q.competency_id,
            theme: q.theme,
            scenario: q.scenario,
            difficulty: q.difficulty,
            rating: DIFFICULTY_RATING[q.difficulty],
            stem: q.stem,
            exams: q.exams,
            images: q.images ?? null,
            options: q.options,
            status,
            hold_reason: status === "in_review" ? (q.hold_reason ?? null) : status === "retired" ? undefined : null,
            published_at: status === "published" ? (old?.published_at ?? now) : (old?.published_at ?? null),
            verification: keepReview ? "medico_revisado" : "ia_verificada",
            ...(keepReview ? {} : { reviewed_by: null, reviewed_at: null }),
            origin: exam?.origin ?? "original_ia",
            license: exam?.license ?? "proprio",
            official_exam_id: exam?.id ?? null,
            official_number: q.official?.number ?? null,
            annulled: q.official?.annulled ?? false,
            annulled_note: q.official?.annulled_note ?? null,
            outdated_note: q.official?.outdated_note ?? null,
            risk_level: q.risk_level,
            lot_id: lot.id,
            expires_on: q.expires_on,
          },
          { onConflict: "slug" },
        )
        .select("id")
        .single(),
    );
    const id = (data as { id: string }).id;
    await check(db.from("question_keys").upsert({ question_id: id, correct_index: key }));
    await check(
      db.from("explanations").upsert({
        question_id: id,
        quick: q.quick,
        reasoning: q.reasoning,
        distractors: q.distractors,
        tip: q.tip,
        pearl: q.pearl,
        competency_note: q.competency_note,
        key_why: q.key_why ?? null,
        theory: q.theory ?? null,
        summary: q.summary ?? null,
      }),
    );
    await check(db.from("question_sources").delete().eq("question_id", id));
    const sources = new Map(q.claims.map((c) => [c.source_id, c.locator]));
    if (sources.size) {
      await check(db.from("question_sources").insert([...sources].map(([source_id, locator]) => ({ question_id: id, source_id, locator }))));
    }
  }
  return summary;
}
