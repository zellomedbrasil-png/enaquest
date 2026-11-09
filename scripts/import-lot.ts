// Importa um lote como rascunho. Nada é publicado aqui: a publicação só acontece
// quando um médico aprova a amostra no painel editorial.
// Uso: npm run content:import -- content/lots/piloto-001.json
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { LotSchema } from "./pipeline/schema";
import { lintLot } from "./pipeline/lint";
import { DIFFICULTY_RATING } from "../src/lib/game/rating";

config({ path: ".env.local" });

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Uso: content:import <lote.json>");
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

  await check(db.from("sources").upsert(lot.sources));
  await check(db.from("review_lots").upsert({ id: lot.id, notes: lot.notes ?? null, status: "pending_review" }));

  for (const q of lot.questions) {
    const { data } = await check(
      db
        .from("questions")
        .upsert(
          {
            slug: q.slug,
            track_id: "enamed",
            area_id: q.area_id,
            competency_id: q.competency_id,
            theme: q.theme,
            scenario: q.scenario,
            difficulty: q.difficulty,
            rating: DIFFICULTY_RATING[q.difficulty],
            stem: q.stem,
            exams: q.exams,
            options: q.options,
            status: "in_review",
            verification: "ia_verificada",
            origin: "original_ia",
            license: "proprio",
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
    await check(db.from("question_keys").upsert({ question_id: id, correct_index: q.correct_index }));
    await check(
      db.from("explanations").upsert({
        question_id: id,
        quick: q.quick,
        reasoning: q.reasoning,
        distractors: q.distractors,
        tip: q.tip,
        pearl: q.pearl,
        competency_note: q.competency_note,
      }),
    );
    await check(db.from("question_sources").delete().eq("question_id", id));
    const sources = new Map(q.claims.map((c) => [c.source_id, c.locator]));
    await check(db.from("question_sources").insert([...sources].map(([source_id, locator]) => ({ question_id: id, source_id, locator }))));
  }
  console.log(`Lote ${lot.id}: ${lot.questions.length} questões importadas como rascunho. Gabarito por letra: ${report.keys.counts.join(", ")}.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
