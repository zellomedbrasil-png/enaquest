// Chamadas ao modelo com saída estruturada, compartilhadas pelo gerador e pelo enriquecimento.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const AUTHOR_MODEL = "claude-opus-5-5";
// Modelo diferente de propósito: a checagem precisa ser independente de quem escreveu.
export const CHECK_MODEL = "claude-sonnet-5-5";

let client: Anthropic | null = null;

function textOf(response: Anthropic.Message): string {
  return response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
}

/** Chamada com saída estruturada. Recusa do modelo vira descarte, não erro fatal. */
export async function structured<T>(model: string, schema: z.ZodType<T>, system: string, prompt: string, effort: "medium" | "high"): Promise<T | null> {
  client ??= new Anthropic();
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
