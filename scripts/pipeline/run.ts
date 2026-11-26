// Só gera e checa um lote, sem importar. Para gerar e já publicar, use content:publicar.
//
// Uso: npm run content:pipeline -- content/blueprints/lote.json content/lots/lote.json
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { lintLot } from "./lint";
import { BlueprintFileSchema, generateLot } from "./generate";

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("Uso: content:pipeline <blueprint.json> <saida.json>");
  const blueprint = BlueprintFileSchema.parse(JSON.parse(readFileSync(input, "utf8")));

  const { lot, rejected } = await generateLot(blueprint);
  const report = lintLot(lot);
  writeFileSync(output, JSON.stringify(lot, null, 2) + "\n");
  writeFileSync(output.replace(/\.json$/, ".relatorio.json"), JSON.stringify({ rejected, lint: report }, null, 2) + "\n");

  const held = lot.questions.filter((q) => q.hold_reason).length;
  const rate = blueprint.items.length ? Math.round((rejected.length / blueprint.items.length) * 100) : 0;
  console.log(`\n${lot.questions.length - held} aprovadas, ${held} precisam de olho, ${rejected.length} descartadas (${rate}%).`);
  if (report.fatalCount) console.log(`Atenção: ${report.fatalCount} problemas de escrita no lote.`);
  if (!report.keys.balanced) console.log(`Gabarito desequilibrado: ${report.keys.counts.join(", ")}.`);
  if (report.duplicates.length) console.log(`Questões parecidas: ${report.duplicates.map((d) => `${d[0]}/${d[1]}`).join(", ")}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
