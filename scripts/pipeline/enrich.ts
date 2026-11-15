// Acrescenta o material de estudo (key_why, theory, summary) às questões de um lote já pronto.
// Não mexe em enunciado, alternativas, gabarito nem no comentário original.
//
// Uso: npm run content:enrich -- content/lots/piloto-001.json [trechos.json] [--force] [--only=slug1,slug2]
//
// trechos.json (opcional): { "id-da-fonte": "trecho do texto da fonte" }. Sem ele, o material
// fica restrito ao que o comentário verificado e as afirmações com fonte da questão sustentam.
// O lote é regravado a cada questão aprovada, então dá para interromper e retomar.
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { LotSchema, StudyExtrasSchema, type LotQuestion, type StudyExtras } from "./schema";
import { lintExtras } from "./lint";
import { AUTHOR_MODEL, CHECK_MODEL, structured } from "./llm";
import { STYLE_RULES } from "./style";

// A chave pode estar no .env.local (como o resto do projeto) ou no .env.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

const CONCURRENCY = 4;

const ExtrasCheckSchema = z.object({
  verdicts: z.array(z.object({ statement: z.string(), supported: z.boolean(), note: z.string() })),
  contradicts_key: z.boolean().describe("O material contradiz o gabarito ou o comentário original."),
  dangerous_content: z.string().nullable(),
});

function material(question: LotQuestion, sourceText: string) {
  const letters = "ABCD";
  return [
    `<questao>`,
    question.stem,
    question.exams ? JSON.stringify(question.exams) : "",
    question.options.map((o, i) => `${letters[i]}. ${o}`).join("\n"),
    `Gabarito: ${letters[question.correct_index]}`,
    `</questao>`,
    `<comentario_verificado>`,
    JSON.stringify({
      quick: question.quick,
      reasoning: question.reasoning,
      distractors: question.distractors,
      tip: question.tip,
      pearl: question.pearl,
      competency_note: question.competency_note,
    }),
    `</comentario_verificado>`,
    `<afirmacoes_com_fonte>`,
    question.claims.map((c) => `- ${c.claim} [${c.source_id}, ${c.locator}]`).join("\n"),
    `</afirmacoes_com_fonte>`,
    sourceText ? `<fontes>\n${sourceText}\n</fontes>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function enrich(question: LotQuestion, texts: Record<string, string>): Promise<{ extras?: StudyExtras; reason?: string }> {
  const ids = [...new Set(question.claims.map((c) => c.source_id))].filter((id) => texts[id]);
  const sourceText = ids.map((id) => `[${id}]\n${texts[id]}`).join("\n\n");
  const context = material(question, sourceText);
  const base = sourceText
    ? "Use apenas o que o comentário verificado, as afirmações com fonte e os trechos das fontes sustentam."
    : "Use apenas o que o comentário verificado e as afirmações com fonte sustentam. Não acrescente número, dose, critério ou recomendação que não esteja ali. Se o material for pouco, faça a revisão do tema mais curta.";

  const extras = await structured(
    AUTHOR_MODEL,
    StudyExtrasSchema,
    `Você escreve material de estudo para estudantes de medicina que se preparam para o ENAMED.\n${STYLE_RULES}`,
    `Escreva o material de estudo desta questão: key_why, theory (revisão do tema "${question.theme}") e summary.\n${base}\n\n${context}`,
    "high",
  );
  if (!extras) return { reason: "O modelo recusou ou a resposta foi cortada." };

  const lint = lintExtras(extras).filter((i) => i.fatal);
  if (lint.length) return { reason: `escrita: ${lint.map((i) => i.message).join(" ")}` };

  const check = await structured(
    CHECK_MODEL,
    ExtrasCheckSchema,
    [
      "Você revisa material médico educacional.",
      "O material de referência é TODO o conteúdo entre as tags <questao>, <comentario_verificado>, <afirmacoes_com_fonte> e, se houver, <fontes>. O comentário verificado (quick, reasoning, distractors, tip, pearl, competency_note) já passou por checagem contra as fontes oficiais e vale como referência tanto quanto as afirmações com fonte.",
      "Uma afirmação do material novo é sustentada quando ela, ou algo equivalente, aparece em qualquer parte desse material de referência, mesmo com outras palavras. Só é não sustentada quando traz número, dose, critério, prazo ou recomendação que não está em nenhuma parte da referência. Conhecimento próprio não conta como sustentação.",
    ].join("\n"),
    `${context}\n\n<material_novo>\n${JSON.stringify(extras)}\n</material_novo>\n\nConfira cada número, dose, critério, prazo e recomendação do material novo contra todo o material de referência acima e liste cada um em "verdicts", dizendo na nota em que parte da referência ele aparece. Diga se o material contradiz o gabarito e aponte qualquer conteúdo que possa causar dano se um médico o seguisse.`,
    "high",
  );
  if (!check) return { reason: "Sem resposta do verificador." };
  if (check.contradicts_key) return { reason: "checagem: contradiz o gabarito ou o comentário." };
  if (check.dangerous_content) return { reason: `checagem: ${check.dangerous_content}` };
  const unsupported = check.verdicts.filter((v) => !v.supported);
  if (unsupported.length) return { reason: `checagem: ${unsupported.map((v) => `${v.statement}: ${v.note}`).join(" | ")}` };
  return { extras };
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
  const [file, textsFile] = args.filter((a) => !a.startsWith("--"));
  if (!file) throw new Error("Uso: content:enrich <lote.json> [trechos.json] [--force] [--only=slug1,slug2]");
  const lot = LotSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const texts: Record<string, string> = textsFile ? z.record(z.string(), z.string()).parse(JSON.parse(readFileSync(textsFile, "utf8"))) : {};

  const todo = lot.questions.filter(
    (q) => (!only || only.includes(q.slug)) && (force || !q.key_why || !q.theory || !q.summary),
  );
  console.log(`${todo.length} questões para enriquecer${textsFile ? " com trechos das fontes" : " sem trechos das fontes"}.`);

  const rejected: { slug: string; reason: string }[] = [];
  let done = 0;
  const save = () => writeFileSync(file, JSON.stringify(LotSchema.parse(lot), null, 2) + "\n");

  const queue = [...todo];
  const worker = async () => {
    for (let question = queue.shift(); question; question = queue.shift()) {
      try {
        const result = await enrich(question, texts);
        if (result.extras) {
          Object.assign(question, result.extras);
          save();
          done += 1;
          console.log(`${question.slug}: ok`);
        } else {
          rejected.push({ slug: question.slug, reason: result.reason ?? "" });
          console.log(`${question.slug}: descartado (${result.reason?.slice(0, 120)})`);
        }
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError) throw error;
        const reason = error instanceof Anthropic.APIError ? `API ${error.status}: ${error.message}` : String(error);
        rejected.push({ slug: question.slug, reason });
        console.error(`${question.slug}: erro (${reason})`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  writeFileSync(file.replace(/\.json$/, ".enriquecimento.json"), JSON.stringify({ done, rejected }, null, 2) + "\n");
  console.log(`\n${done} enriquecidas, ${rejected.length} descartadas. Relatório: ${file.replace(/\.json$/, ".enriquecimento.json")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
