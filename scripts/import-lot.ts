// Importa um lote sem publicar: as questões ficam fora do ar, na lista "Aguardando" do painel.
// Para checar e já publicar, use content:publicar.
// Uso: npm run content:import -- content/lots/piloto-001.json
//
// Com --enrich-only, só grava o material de estudo (key_why, theory, summary) das questões que já
// existem, sem tocar em status, enunciado ou gabarito. É o jeito seguro de atualizar questões publicadas.
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { LotSchema } from "./pipeline/schema";
import { lintLot } from "./pipeline/lint";
import { importLot } from "./content/import";

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

  const summary = await importLot(db, lot, { publish: false });
  const exam = lot.official_exam;
  const annulled = lot.questions.filter((q) => q.official?.annulled).length;
  console.log(
    `Lote ${lot.id}: ${summary.drafts} questões importadas fora do ar.${summary.keptRetired ? ` ${summary.keptRetired} continuam retiradas.` : ""} Gabarito por letra: ${report.keys.counts.join(", ")}.` +
      (exam ? ` Prova: ${exam.name}${exam.booklet ? ` (${exam.booklet})` : ""}, gabarito ${exam.key_status}, licença ${exam.license}, ${annulled} anulada(s).` : ""),
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
