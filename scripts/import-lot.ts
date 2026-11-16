// Importa um lote como rascunho. Nada é publicado aqui: a publicação só acontece
// quando um médico aprova a amostra no painel editorial.
// Uso: npm run content:import -- content/lots/piloto-001.json
//
// Com --enrich-only, só grava o material de estudo (key_why, theory, summary) das questões que já
// existem, sem tocar em status, enunciado ou gabarito. É o jeito seguro de atualizar questões publicadas.
import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { LotSchema } from "./pipeline/schema";
import { lintLot } from "./pipeline/lint";
import { DIFFICULTY_RATING } from "../src/lib/game/rating";

config({ path: ".env.local" });

async function main() {
  const args = process.argv.slice(2);
  const enrichOnly = args.includes("--enrich-only");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Uso: content:import <lote.json> [--enrich-only]");
  const lot = LotSchema.parse(JSON.parse(readFileSync(file, "utf8")));

  const report = lintLot(lot);
  if (report.fatalCount || report.duplicateSlugs.length) {
    console.error(JSON.stringify(report.report.filter((r) => r.issues.some((i) => i.fatal)), null, 2));
    throw new Error(`Lote recusado: ${report.fatalCount} problemas de escrita e ${report.duplicateSlugs.length} slugs repetidos.`);
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const check = async <T extends { error: { message: string } | null }>(result: PromiseLike<T>) => {
    const value = await result;
    if (value.error) throw new Error(value.error.message);
    return value;
  };

  if (enrichOnly) {
    let updated = 0;
    const missing: string[] = [];
    for (const q of lot.questions) {
      if (!q.key_why && !q.theory && !q.summary) continue;
      const { data } = await check(db.from("questions").select("id").eq("slug", q.slug).maybeSingle());
      const id = (data as { id: string } | null)?.id;
      if (!id) {
        missing.push(q.slug);
        continue;
      }
      await check(
        db
          .from("explanations")
          .update({ key_why: q.key_why ?? null, theory: q.theory ?? null, summary: q.summary ?? null })
          .eq("question_id", id),
      );
      updated += 1;
    }
    console.log(`Lote ${lot.id}: material de estudo gravado em ${updated} questões.${missing.length ? ` Não encontradas no banco: ${missing.join(", ")}.` : ""}`);
    return;
  }

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

  // Figuras do enunciado: arquivo em content/media/<src>, enviado ao bucket público question-media.
  for (const image of lot.questions.flatMap((q) => q.images ?? [])) {
    if (/^https?:\/\//.test(image.src)) continue;
    const file = join("content", "media", image.src);
    if (!existsSync(file)) throw new Error(`Figura não encontrada: ${file}`);
    const type = image.src.endsWith(".png") ? "image/png" : "image/jpeg";
    const { error } = await db.storage.from("question-media").upload(image.src, readFileSync(file), { upsert: true, contentType: type });
    if (error) throw new Error(`Falha ao enviar ${image.src}: ${error.message}`);
  }

  await check(db.from("sources").upsert(lot.sources));
  await check(db.from("review_lots").upsert({ id: lot.id, notes: lot.notes ?? null, status: "pending_review" }));

  for (const q of lot.questions) {
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
            status: "in_review",
            verification: "ia_verificada",
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
    // Anulada: sem gabarito válido. O preliminar fica só no JSON do lote, para registro.
    await check(db.from("question_keys").upsert({ question_id: id, correct_index: q.official?.annulled ? null : q.correct_index }));
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
    await check(db.from("question_sources").insert([...sources].map(([source_id, locator]) => ({ question_id: id, source_id, locator }))));
  }
  const annulled = lot.questions.filter((q) => q.official?.annulled).length;
  console.log(
    `Lote ${lot.id}: ${lot.questions.length} questões importadas como rascunho. Gabarito por letra: ${report.keys.counts.join(", ")}.` +
      (exam ? ` Prova: ${exam.name}${exam.booklet ? ` (${exam.booklet})` : ""}, gabarito ${exam.key_status}, licença ${exam.license}, ${annulled} anulada(s).` : ""),
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
