// Um comando só: gera (se for roteiro), checa, importa e publica.
// A questão que passa em todas as checagens vai ao ar com o selo "Verificada por IA".
// A que levanta dúvida é importada fora do ar e aparece em "Precisa de olho" no /admin.
//
// Uso:
//   npm run content:publicar -- content/blueprints/lote.json   (roteiro: gera, checa e publica)
//   npm run content:publicar -- content/lots/piloto-001.json   (lote pronto: checa e publica)
//   npm run content:publicar -- content/lots/enamed-2025-c1.json (prova oficial: publica direto)
//   --simular  faz as checagens e grava os arquivos, sem tocar no banco
//
// O banco de destino vem de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
// (do .env.local, ou das variáveis já definidas no terminal, que têm prioridade).
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { LotSchema, type Lot, type LotQuestion } from "./pipeline/schema";
import { lintLot } from "./pipeline/lint";
import { BlueprintFileSchema, generateLot } from "./pipeline/generate";
import { checkExistingQuestion } from "./pipeline/checks";
import { importLot } from "./content/import";

config({ path: ".env.local" });

type CachedVerdict = { hash: string; hold_reason: string | null };

const hashOf = (q: LotQuestion) =>
  createHash("sha256")
    .update(JSON.stringify({ ...q, hold_reason: undefined }))
    .digest("hex");

/** Lote já escrito: checa cada questão, reaproveitando o resultado das que não mudaram. */
async function recheck(lot: Lot, cacheFile: string): Promise<Lot> {
  const cache: Record<string, CachedVerdict> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")) : {};
  const questions: LotQuestion[] = [];
  for (const q of lot.questions) {
    const hash = hashOf(q);
    let holdReason: string | null;
    if (cache[q.slug]?.hash === hash) {
      holdReason = cache[q.slug].hold_reason;
      console.log(`${q.slug}: ${holdReason ? "precisa de olho" : "ok"} (checagem anterior)`);
    } else {
      try {
        const verdict = await checkExistingQuestion(q, q.risk_level);
        holdReason = verdict.ok ? null : `${verdict.stage}: ${verdict.reason}`;
      } catch (error) {
        holdReason = `erro: ${error instanceof Error ? error.message : String(error)}`;
      }
      // Erro de API não entra no cache, para tentar de novo na próxima vez.
      if (!holdReason?.startsWith("erro:")) cache[q.slug] = { hash, hold_reason: holdReason };
      writeFileSync(cacheFile, JSON.stringify(cache, null, 2) + "\n");
      console.log(`${q.slug}: ${holdReason ? `precisa de olho (${holdReason})` : "ok"}`);
    }
    questions.push({ ...q, hold_reason: q.hold_reason ?? holdReason ?? undefined });
  }
  return { ...lot, questions };
}

async function main() {
  const args = process.argv.slice(2);
  const simulate = args.includes("--simular");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) throw new Error("Uso: content:publicar <roteiro-ou-lote.json> [--simular]");
  const raw = JSON.parse(readFileSync(file, "utf8"));

  let lot: Lot;
  if (Array.isArray(raw.items)) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Gerar questões precisa da ANTHROPIC_API_KEY.");
    const blueprint = BlueprintFileSchema.parse(raw);
    const generated = await generateLot(blueprint);
    lot = generated.lot;
    const out = `content/lots/${lot.id}.json`;
    writeFileSync(out, JSON.stringify(lot, null, 2) + "\n");
    writeFileSync(out.replace(/\.json$/, ".relatorio.json"), JSON.stringify({ rejected: generated.rejected, lint: lintLot(lot) }, null, 2) + "\n");
    console.log(`Lote gravado em ${out}. ${generated.rejected.length} descartadas (motivos no .relatorio.json).`);
  } else {
    lot = LotSchema.parse(raw);
    if (lot.official_exam) {
      console.log(`Prova oficial (${lot.official_exam.name}): enunciado e gabarito são os da banca, publicação direta.`);
    } else {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("Checar um lote precisa da ANTHROPIC_API_KEY. Sem ela, nada é publicado.");
      lot = await recheck(lot, file.replace(/\.json$/, ".checagem.json"));
    }
  }

  const report = lintLot(lot);
  if (report.fatalCount || report.duplicateSlugs.length) {
    console.error(JSON.stringify(report.report.filter((r) => r.issues.some((i) => i.fatal)), null, 2));
    throw new Error(`Lote recusado: ${report.fatalCount} problemas de escrita e ${report.duplicateSlugs.length} slugs repetidos.`);
  }

  const held = lot.questions.filter((q) => q.hold_reason);
  if (simulate) {
    console.log(`\nSimulação: ${lot.questions.length - held.length} iriam ao ar e ${held.length} precisam de olho. Nada foi gravado no banco.`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  console.log(`\nPublicando em ${new URL(url).host}...`);
  const summary = await importLot(db, lot, { publish: true });

  console.log(`Lote ${lot.id}: ${summary.published} no ar, ${summary.held} precisam de olho no /admin.`);
  if (summary.keptRetired) console.log(`${summary.keptRetired} continuam retiradas (foram retiradas antes e não mudaram).`);
  if (summary.reviewKept) console.log(`${summary.reviewKept} mantêm o selo de revisada por médico.`);
  for (const q of held) console.log(`  · ${q.slug}: ${q.hold_reason}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
