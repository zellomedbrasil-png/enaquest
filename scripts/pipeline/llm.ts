// Chamadas ao modelo com saída estruturada, compartilhadas pelo gerador, pelas checagens e pelo enriquecimento.
//
// Provedor: com OPENROUTER_API_KEY, tudo passa pelo OpenRouter (modelos "empresa/modelo").
// Sem ela, cai na API da Anthropic (modelos "claude-..."), como antes.
//
// Escolha padrão (pesquisa de 2026-11-26, ranking medbench-brasil no ENAMED + preços do OpenRouter):
// - autor: DeepSeek V4 Pro, 95,7% no ENAMED 2026 sem contaminação, US$ 0,89 / 1,51 por milhão de tokens;
// - verificador: Gemini 3.6 Flash, de outra empresa, para a checagem ser independente;
// - segunda opinião do alto risco: Qwen 3.7 Max, uma terceira família.
// Cada um pode ser trocado por variável de ambiente, sem mudar código.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const viaOpenRouter = () => Boolean(process.env.OPENROUTER_API_KEY);

export const AUTHOR_MODEL = process.env.QUESTOES_MODELO_AUTOR || (viaOpenRouter() ? "deepseek/deepseek-v4-pro" : "claude-opus-5-5");
// Modelo diferente de propósito: a checagem precisa ser independente de quem escreveu.
export const CHECK_MODEL = process.env.QUESTOES_MODELO_VERIFICADOR || (viaOpenRouter() ? "google/gemini-3.6-flash" : "claude-sonnet-5-5");
export const SECOND_MODEL = process.env.QUESTOES_MODELO_SEGUNDA_OPINIAO || (viaOpenRouter() ? "qwen/qwen3.7-max" : AUTHOR_MODEL);

/** Erro do provedor que vale para o lote inteiro: sem crédito, chave inválida, sem permissão. */
export class ProviderFatalError extends Error {}

/**
 * Erro que vale para o lote inteiro (sem crédito, chave inválida, sem permissão).
 * Nesses casos o comando para, em vez de marcar cada questão como "precisa de olho".
 */
export function isFatalApiError(error: unknown): boolean {
  if (error instanceof ProviderFatalError) return true;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return true;
  return error instanceof Anthropic.APIError && error.status === 400 && /credit balance/i.test(error.message);
}

// ---------- Custo ----------
let spent = 0;
/** Custo acumulado nesta execução, em dólares (só o OpenRouter informa). */
export const spentDollars = () => spent;

/** Figura enviada junto com o texto (questão de prova com ECG, foto, exame de imagem). */
export type PromptImage = { mediaType: "image/png" | "image/jpeg"; base64: string };

/** Chamada com saída estruturada. Recusa ou resposta cortada vira null (descarte), não erro fatal. */
export async function structured<T>(
  model: string,
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
  effort: "medium" | "high",
  images: PromptImage[] = [],
): Promise<T | null> {
  return model.includes("/") ? openRouter(model, schema, system, prompt, effort, images) : anthropic(model, schema, system, prompt, effort, images);
}

// ---------- OpenRouter ----------
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Tira o JSON da resposta, mesmo que venha dentro de ```json ... ``` ou com texto em volta. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
    throw new Error("Resposta sem JSON");
  }
}

type OpenRouterResponse = {
  choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { cost?: number };
  error?: { code?: number; message?: string };
};

async function openRouter<T>(
  model: string,
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
  effort: "medium" | "high",
  images: PromptImage[],
): Promise<T | null> {
  const content = images.length
    ? [
        ...images.map((image) => ({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.base64}` } })),
        { type: "text", text: prompt },
      ]
    : prompt;
  const body = {
    model,
    max_tokens: 16000,
    reasoning: { effort },
    // Só usa provedores que respeitam o formato pedido.
    provider: { require_parameters: true },
    usage: { include: true },
    response_format: { type: "json_schema", json_schema: { name: "resposta", strict: false, schema: z.toJSONSchema(schema as z.ZodType) } },
    messages: [
      { role: "system", content: `${system}\nResponda somente com um objeto JSON válido no formato pedido.` },
      { role: "user", content },
    ],
  };

  // Uma nova tentativa para falha passageira (sobrecarga, limite de taxa, JSON quebrado).
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://enaquest.com",
        "X-Title": "EnaQuest",
      },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as OpenRouterResponse;
    const status = response.ok ? (data.error?.code ?? 200) : response.status;
    if (status === 401 || status === 402 || status === 403) {
      throw new ProviderFatalError(`OpenRouter ${status}: ${data.error?.message ?? response.statusText}`);
    }
    if (status >= 400) {
      if (attempt < 3 && (status === 429 || status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        continue;
      }
      throw new Error(`OpenRouter ${status}: ${data.error?.message ?? "erro"}`);
    }
    spent += data.usage?.cost ?? 0;
    const choice = data.choices?.[0];
    if (!choice?.message?.content || choice.message.refusal || choice.finish_reason === "length") return null;
    try {
      return schema.parse(extractJson(choice.message.content));
    } catch (error) {
      if (attempt < 2) continue;
      throw error;
    }
  }
}

// ---------- Anthropic ----------
let client: Anthropic | null = null;

function textOf(response: Anthropic.Message): string {
  return response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
}

async function anthropic<T>(
  model: string,
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
  effort: "medium" | "high",
  images: PromptImage[],
): Promise<T | null> {
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
    messages: [
      {
        role: "user",
        content: images.length
          ? [
              ...images.map((image) => ({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } })),
              { type: "text", text: prompt },
            ]
          : prompt,
      },
    ],
  } as never);
  const response = (await stream.finalMessage()) as unknown as Anthropic.Message;
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  return schema.parse(JSON.parse(textOf(response)));
}
