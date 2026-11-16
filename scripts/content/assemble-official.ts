// Monta o lote de uma prova oficial a partir de arquivos locais, sem chamar API nenhuma:
// transcrição + gabarito + um comentário por questão (comments_dir/qNN.json).
//
// Uso: npm run content:assemble -- content/official/enamed-2025/config.json [--offline]
//
// - Questão sem arquivo de comentário fica de fora e entra na lista de pendentes do relatório.
// - Fontes novas só entram com o endereço respondendo (doi.org/Crossref/HTTP). Use --offline para pular essa checagem.
// - Questão com key_concern ou review_note entra com risco alto, para a revisão médica ver primeiro.
// - O catálogo de fontes (content/sources/catalogo.json) cresce com as fontes novas aceitas.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { lintLot } from "../pipeline/lint";
import { LotSchema, SourceSchema, type Lot, type LotQuestion, type Source } from "../pipeline/schema";
import { acceptNewSources, buildQuestion, ConfigSchema, LocalCommentSchema, TranscribedSchema } from "../pipeline/official-shared";

export type AssembleReport = {
  total: number;
  assembled: number;
  pending: number[];
  invalid: { n: number; reason: string }[];
  dropped_sources: string[];
  priority: Record<string, string>;
  lint: ReturnType<typeof lintLot>;
};

/** Núcleo sem arquivos de saída, para os testes. */
export async function assemble(input: {
  cfg: z.infer<typeof ConfigSchema>;
  transcription: z.infer<typeof TranscribedSchema>[];
  keys: Record<string, string>;
  catalog: Source[];
  readComment: (n: number) => unknown | null;
  checkSources: boolean;
  today?: string;
}): Promise<{ lot: Lot; catalog: Source[]; report: AssembleReport }> {
  const { cfg, transcription, keys, readComment } = input;
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const catalog = [...input.catalog];
  const cache = new Map<string, boolean>();
  const questions: LotQuestion[] = [];
  const used = new Map<string, Source>();
  const report: Omit<AssembleReport, "lint"> = { total: transcription.length, assembled: 0, pending: [], invalid: [], dropped_sources: [], priority: {} };

  for (const q of [...transcription].sort((a, b) => a.n - b.n)) {
    const key = keys[String(q.n)];
    if (!key) {
      report.invalid.push({ n: q.n, reason: "Sem gabarito." });
      continue;
    }
    const raw = readComment(q.n);
    if (raw === null) {
      report.pending.push(q.n);
      continue;
    }
    const parsed = LocalCommentSchema.safeParse(raw);
    if (!parsed.success) {
      report.invalid.push({ n: q.n, reason: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      continue;
    }
    const draft = parsed.data;

    if (input.checkSources) {
      const added = await acceptNewSources(draft, catalog, cache, today, `Q${q.n}`);
      catalog.push(...added.accepted);
      report.dropped_sources.push(...added.dropped);
    } else {
      for (const source of draft.new_sources) {
        const ok = SourceSchema.safeParse({ ...source, checked_on: today });
        if (ok.success && !catalog.some((s) => s.id === source.id)) catalog.push(ok.data);
      }
    }
    const known = new Map(catalog.map((s) => [s.id, s]));
    const claims = draft.claims.filter((c) => known.has(c.source_id));
    const lost = draft.claims.length - claims.length;
    if (!claims.length) {
      report.invalid.push({ n: q.n, reason: "Nenhuma fonte do comentário é verificável." });
      continue;
    }
    for (const c of claims) used.set(c.source_id, known.get(c.source_id)!);

    const notes = [draft.key_concern, draft.review_note, lost ? `${lost} afirmação(ões) sem fonte verificável foram removidas.` : null].filter(Boolean) as string[];
    if (notes.length) report.priority[String(q.n)] = notes.join(" | ");
    questions.push(buildQuestion({ q, key, draft, claims, cfg, priority: notes.length > 0 }));
  }

  const lot: Lot = {
    id: cfg.exam.id,
    notes: `${cfg.exam.name}${cfg.exam.booklet ? `, ${cfg.exam.booklet}` : ""}. Comentários escritos e conferidos por IA; revisão médica pendente.`,
    official_exam: cfg.exam,
    sources: [...used.values()],
    questions,
  };
  report.assembled = questions.length;
  return { lot, catalog, report: { ...report, lint: lintLot(lot) } };
}

async function main() {
  const args = process.argv.slice(2);
  const cfgPath = args.find((a) => !a.startsWith("--"));
  if (!cfgPath) throw new Error("Uso: content:assemble <config.json> [--offline]");
  const cfg = ConfigSchema.parse(JSON.parse(readFileSync(cfgPath, "utf8")));
  if (!cfg.comments_dir) throw new Error('Falta "comments_dir" no config.');
  const catalogPath = cfg.catalog ?? "content/sources/catalogo.json";
  const catalogFile = JSON.parse(readFileSync(catalogPath, "utf8")) as { sources: unknown[] };
  const catalog = z.array(SourceSchema).parse(catalogFile.sources);

  const result = await assemble({
    cfg,
    transcription: z.array(TranscribedSchema).parse(JSON.parse(readFileSync(cfg.transcription, "utf8"))),
    keys: z.record(z.string(), z.string()).parse(JSON.parse(readFileSync(cfg.key, "utf8"))),
    catalog,
    readComment: (n) => {
      const file = join(cfg.comments_dir!, `q${String(n).padStart(2, "0")}.json`);
      return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
    },
    checkSources: !args.includes("--offline"),
  });

  mkdirSync(dirname(cfg.output), { recursive: true });
  writeFileSync(cfg.output, JSON.stringify(LotSchema.parse(result.lot), null, 2) + "\n");
  writeFileSync(cfg.output.replace(/\.json$/, ".relatorio.json"), JSON.stringify(result.report, null, 2) + "\n");
  writeFileSync(catalogPath, JSON.stringify({ sources: result.catalog }, null, 2) + "\n");

  const r = result.report;
  const annulled = result.lot.questions.filter((q) => q.official?.annulled).length;
  console.log(`${r.assembled} de ${r.total} questões montadas (${annulled} anuladas/excluídas). Pendentes de comentário: ${r.pending.length}.`);
  if (r.invalid.length) console.log(`Com problema: ${r.invalid.map((i) => `Q${i.n} (${i.reason})`).join("; ")}`);
  if (r.lint.fatalCount) console.log(`Atenção: ${r.lint.fatalCount} problemas de escrita.`);
  if (r.dropped_sources.length) console.log(`Fontes recusadas: ${r.dropped_sources.length}.`);
  console.log(`Revisão prioritária: ${Object.keys(r.priority).length} questões.`);
  
}

if (process.argv[1] && /assemble-official/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
