// Gera um lote a partir de um roteiro (blueprint) e passa cada questão pelas checagens.
// Entrada: { "id": "...", "sources": [...], "source_texts": { "id": "trecho" }, "items": [...] }
// Sem o trecho da fonte, a questão não é gerada.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AuthorDraftSchema, BlueprintItemSchema, LotSchema, SourceSchema, type BlueprintItem, type Lot, type LotQuestion } from "./schema";
import { lintDraft } from "./lint";
import { AUTHOR_MODEL, isFatalApiError, structured } from "./llm";
import { STYLE_RULES } from "./style";
import { checkNewQuestion } from "./checks";

type AuthorDraft = z.infer<typeof AuthorDraftSchema>;

export const BlueprintFileSchema = z.object({
  id: z.string(),
  notes: z.string().optional(),
  sources: z.array(SourceSchema),
  source_texts: z.record(z.string(), z.string()),
  items: z.array(BlueprintItemSchema),
});
export type BlueprintFile = z.infer<typeof BlueprintFileSchema>;

export type Outcome = { slug: string; stage: string; reason: string };

async function draftQuestion(item: BlueprintItem, sourceText: string): Promise<AuthorDraft | null> {
  return structured(
    AUTHOR_MODEL,
    AuthorDraftSchema,
    `Você escreve questões originais de múltipla escolha para estudantes de medicina que se preparam para o ENAMED.\n${STYLE_RULES}`,
    `Escreva uma questão original.\n\nÁrea: ${item.area_id}\nCompetência: ${item.competency_id}\nTema: ${item.theme}\nCenário: ${item.scenario}\nDificuldade: ${item.difficulty}\n\nUse apenas o que estas fontes sustentam. Em "claims", cite o source_id exato e o local.\n\n<fontes>\n${sourceText}\n</fontes>`,
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

  const verdict = await checkNewQuestion(draft, sourceText, item.risk_level);
  if (!verdict.ok && !verdict.hold) return reject(verdict.stage, verdict.reason);

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
      ...(verdict.ok ? {} : { hold_reason: `${verdict.stage}: ${verdict.reason}` }),
    },
  };
}

/** Gera e checa. As questões com dúvida entram no lote com hold_reason; as reprovadas ficam de fora. */
export async function generateLot(blueprint: BlueprintFile, log: (line: string) => void = console.log): Promise<{ lot: Lot; rejected: Outcome[] }> {
  const questions: LotQuestion[] = [];
  const rejected: Outcome[] = [];
  for (const item of blueprint.items) {
    try {
      const result = await processItem(item, blueprint.source_texts);
      if (result.question) questions.push(result.question);
      if (result.rejected) rejected.push(result.rejected);
      const status = result.question ? (result.question.hold_reason ? "precisa de olho" : "ok") : `descartada (${result.rejected?.stage})`;
      log(`${item.slug}: ${status}`);
    } catch (error) {
      if (isFatalApiError(error)) throw error;
      const reason = error instanceof Anthropic.APIError ? `API ${error.status}` : String(error);
      rejected.push({ slug: item.slug, stage: "erro", reason });
      log(`${item.slug}: erro (${reason})`);
    }
  }
  if (!questions.length) throw new Error(`Nenhuma questão do roteiro ${blueprint.id} passou nas checagens.`);
  const lot = LotSchema.parse({ id: blueprint.id, notes: blueprint.notes, sources: blueprint.sources, questions });
  return { lot, rejected };
}
