// Gera um lote de questões. Roda fora do app do aluno e nunca publica nada sozinho:
// o resultado precisa ser importado (content:import) e aprovado no painel editorial.
//
// Uso: npm run content:pipeline -- content/blueprints/lote.json content/lots/lote.json
//
// Entrada: { "id": "...", "sources": [...], "source_texts": { "id": "trecho" }, "items": [...] }
// Sem o trecho da fonte, a questão não é gerada.
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BlindAnswerSchema, BlueprintItemSchema, DraftSchema, FactCheckSchema, LotSchema, SourceSchema, type BlueprintItem, type Draft, type LotQuestion } from "./schema";
import { lintDraft, lintLot } from "./lint";
import { STYLE_RULES } from "./style";

const AUTHOR_MODEL = "claude-opus-5-5";
// Modelo diferente de propósito: a checagem precisa ser independente de quem escreveu.
const CHECK_MODEL = "claude-sonnet-5-5";

const client = new Anthropic();

const BlueprintFile = z.object({
  id: z.string(),
  notes: z.string().optional(),
  sources: z.array(SourceSchema),
  source_texts: z.record(z.string(), z.string()),
  items: z.array(BlueprintItemSchema),
});

type Outcome = { slug: string; stage: string; reason: string };

function textOf(response: Anthropic.Message): string {
  return response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
}

/** Chamada com saída estruturada. Recusa do modelo vira descarte, não erro fatal. */
async function structured<T>(model: string, schema: z.ZodType<T>, system: string, prompt: string, effort: "medium" | "high"): Promise<T | null> {
  // Com fallback ativado: se os filtros de segurança recusarem um tema médico sensível,
  // a API tenta outro modelo. A checagem independente continua valendo para o resultado.
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 16000,
    system,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: zodOutputFormat(schema as never) },
    messages: [{ role: "user", content: prompt }],
  } as never);
  const response = (await stream.finalMessage()) as unknown as Anthropic.Message;
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  return schema.parse(JSON.parse(textOf(response)));
}

async function draftQuestion(item: BlueprintItem, sourceText: string): Promise<Draft | null> {
  return structured(
    AUTHOR_MODEL,
    DraftSchema,
    `Você escreve questões originais de múltipla escolha para estudantes de medicina que se preparam para o ENAMED.\n${STYLE_RULES}`,
    `Escreva uma questão original.\n\nÁrea: ${item.area_id}\nCompetência: ${item.competency_id}\nTema: ${item.theme}\nCenário: ${item.scenario}\nDificuldade: ${item.difficulty}\n\nUse apenas o que estas fontes sustentam. Em "claims", cite o source_id exato e o local.\n\n<fontes>\n${sourceText}\n</fontes>`,
    "high",
  );
}

async function blindSolve(draft: Draft) {
  const options = draft.options.map((o, i) => `${"ABCD"[i]}. ${o}`).join("\n");
  const exams = draft.exams ? `\n${JSON.stringify(draft.exams)}` : "";
  return structured(
    CHECK_MODEL,
    BlindAnswerSchema,
    "Você é um médico experiente respondendo a uma prova. Responda com base nas diretrizes brasileiras vigentes. Índices de 0 a 3.",
    `${draft.stem}${exams}\n\n${options}`,
    "high",
  );
}

async function factCheck(draft: Draft, sourceText: string) {
  return structured(
    CHECK_MODEL,
    FactCheckSchema,
    "Você revisa conteúdo médico educacional. Marque como sustentada apenas a afirmação que está de fato nas fontes fornecidas. Conhecimento próprio não conta como sustentação.",
    `<fontes>\n${sourceText}\n</fontes>\n\n<questao>\n${JSON.stringify(draft)}\n</questao>\n\nConfira cada item de "claims". Diga se o gabarito está correto e aponte qualquer conteúdo que possa causar dano se um médico o seguisse.`,
    "high",
  );
}

async function processItem(item: BlueprintItem, texts: Record<string, string>): Promise<{ question?: LotQuestion; rejected?: Outcome }> {
  const reject = (stage: string, reason: string) => ({ rejected: { slug: item.slug, stage, reason } });

  const available = item.source_ids.filter((id) => texts[id]);
  if (!available.length) return reject("fontes", "Sem trecho de fonte: a questão não é gerada.");
  const sourceText = available.map((id) => `[${id}]\n${texts[id]}`).join("\n\n");

  const draft = await draftQuestion(item, sourceText);
  if (!draft) return reject("rascunho", "O modelo recusou ou a resposta foi cortada.");

  const lint = lintDraft(draft).filter((issue) => issue.fatal);
  if (lint.length) return reject("escrita", lint.map((issue) => issue.message).join(" "));

  const blind = await blindSolve(draft);
  if (!blind) return reject("resolucao_cega", "Sem resposta do verificador.");
  if (blind.answer_index !== draft.correct_index) return reject("resolucao_cega", `Respondeu ${"ABCD"[blind.answer_index]}, gabarito ${"ABCD"[draft.correct_index]}.`);
  if (blind.other_defensible.length) return reject("resolucao_cega", "Mais de uma alternativa pode ser defendida.");
  if (blind.stem_problem) return reject("resolucao_cega", blind.stem_problem);

  const check = await factCheck(draft, sourceText);
  if (!check) return reject("checagem", "Sem resposta do verificador.");
  if (!check.key_is_correct) return reject("checagem", "O verificador discorda do gabarito.");
  if (check.dangerous_content) return reject("checagem", check.dangerous_content);
  const unsupported = check.verdicts.filter((v) => !v.supported);
  if (unsupported.length) return reject("checagem", unsupported.map((v) => `${v.claim}: ${v.note}`).join(" | "));

  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 2);
  return {
    question: {
      ...draft,
      slug: item.slug,
      area_id: item.area_id,
      competency_id: item.competency_id,
      theme: item.theme,
      scenario: item.scenario,
      difficulty: item.difficulty,
      risk_level: item.risk_level,
      expires_on: expires.toISOString().slice(0, 10),
    },
  };
}

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("Uso: content:pipeline <blueprint.json> <saida.json>");
  const blueprint = BlueprintFile.parse(JSON.parse(readFileSync(input, "utf8")));

  const questions: LotQuestion[] = [];
  const rejected: Outcome[] = [];
  for (const item of blueprint.items) {
    try {
      const result = await processItem(item, blueprint.source_texts);
      if (result.question) questions.push(result.question);
      if (result.rejected) rejected.push(result.rejected);
      console.log(`${item.slug}: ${result.question ? "ok" : `descartada (${result.rejected?.stage})`}`);
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) throw error;
      const reason = error instanceof Anthropic.APIError ? `API ${error.status}` : String(error);
      rejected.push({ slug: item.slug, stage: "erro", reason });
      console.error(`${item.slug}: erro (${reason})`);
    }
  }

  const lot = LotSchema.parse({ id: blueprint.id, notes: blueprint.notes, sources: blueprint.sources, questions });
  const report = lintLot(lot);
  writeFileSync(output, JSON.stringify(lot, null, 2) + "\n");
  writeFileSync(output.replace(/\.json$/, ".relatorio.json"), JSON.stringify({ rejected, lint: report }, null, 2) + "\n");

  const rate = blueprint.items.length ? Math.round((rejected.length / blueprint.items.length) * 100) : 0;
  console.log(`\n${questions.length} aprovadas, ${rejected.length} descartadas (${rate}%).`);
  if (report.fatalCount) console.log(`Atenção: ${report.fatalCount} problemas de escrita no lote.`);
  if (!report.keys.balanced) console.log(`Gabarito desequilibrado: ${report.keys.counts.join(", ")}.`);
  if (report.duplicates.length) console.log(`Questões parecidas: ${report.duplicates.map((d) => `${d[0]}/${d[1]}`).join(", ")}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
