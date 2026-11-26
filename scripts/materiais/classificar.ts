// Classifica os trechos de material ainda pendentes: tipo, área e tema do temário.
// Roda no GitHub Actions (onde está a chave do OpenRouter), com limite de gasto.
// Uso: npm run materiais:classificar   (MATERIAIS_LIMITE_DOLARES, padrão 5)
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AREA_IDS } from "../pipeline/schema";
import { TemarioSchema } from "../pipeline/daily-plan";
import { isFatalApiError, spentDollars, structuredWithReason } from "../pipeline/llm";

config({ path: ".env.local", quiet: true });

// Barato e rápido: a tarefa é só rotular.
const MODEL = process.env.MATERIAIS_MODELO || "deepseek/deepseek-v4-flash";

const LabelSchema = z.object({
  tipo: z.enum(["teoria", "questao_comentada", "questao_sem_comentario", "indice", "outro"]),
  area_id: z.enum(AREA_IDS).nullable(),
  tema: z.string().nullable().describe("Exatamente um tema da lista, copiado igual, ou null se nenhum serve."),
  assunto: z.string().describe("O assunto médico principal do trecho, em até 8 palavras."),
});

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  if (!process.env.OPENROUTER_API_KEY) throw new Error("Classificar precisa da OPENROUTER_API_KEY.");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const budget = Number(process.env.MATERIAIS_LIMITE_DOLARES || 5);

  const temario = TemarioSchema.parse(JSON.parse(readFileSync("content/temas/temario.json", "utf8")));
  const themes = new Map<string, string>();
  for (const area of AREA_IDS) for (const t of temario.temas[area] ?? []) themes.set(t.tema, area);
  const list = AREA_IDS.map((area) => `${area}:\n${(temario.temas[area] ?? []).map((t) => `- ${t.tema}`).join("\n")}`).join("\n\n");
  const system = `Você classifica trechos de material de estudo para provas de residência médica (ENAMED/ENARE).
Responda o tipo do trecho, a área (${AREA_IDS.join(", ")}) e o tema da lista abaixo que melhor descreve o conteúdo principal.
Use "indice" para sumário, tabela de contagem de questões, capa ou propaganda. Se nenhum tema servir bem, tema = null.

<temas>
${list}
</temas>`;

  let done = 0;
  let failed = 0;
  for (;;) {
    if (spentDollars() >= budget) {
      console.log(`Limite de US$ ${budget} atingido.`);
      break;
    }
    const { data: pending, error } = await db.from("material_chunks").select("id, texto").is("classificado_em", null).limit(60);
    if (error) throw new Error(error.message);
    if (!pending?.length) break;

    await Promise.all(
      pending.map(async (chunk) => {
        try {
          const answer = await structuredWithReason(MODEL, LabelSchema, system, `<trecho>\n${chunk.texto.slice(0, 6000)}\n</trecho>`, "medium");
          const label = answer.value;
          // Tema fora da lista vira null; a área vem do tema quando ele existe.
          const tema = label?.tema && themes.has(label.tema) ? label.tema : null;
          const update = label
            ? { tipo: label.tipo, area_id: tema ? themes.get(tema) : label.area_id, tema, assunto: label.assunto.slice(0, 120), classificado_em: new Date().toISOString() }
            : { tipo: "outro", classificado_em: new Date().toISOString() };
          const { error: saveError } = await db.from("material_chunks").update(update).eq("id", chunk.id);
          if (saveError) throw new Error(saveError.message);
          done += 1;
        } catch (err) {
          if (isFatalApiError(err)) throw err;
          failed += 1;
          // Marca como "outro" para não travar a fila; dá para reclassificar zerando classificado_em.
          await db.from("material_chunks").update({ tipo: "outro", classificado_em: new Date().toISOString() }).eq("id", chunk.id);
        }
      }),
    );
    console.log(`${done} classificados, ${failed} com erro. Gasto: US$ ${spentDollars().toFixed(2)}`);
  }

  const { count: left } = await db.from("material_chunks").select("id", { count: "exact", head: true }).is("classificado_em", null);
  const { count: withTheme } = await db.from("material_chunks").select("id", { count: "exact", head: true }).not("tema", "is", null);
  console.log(`\nFim: ${done} classificados nesta rodada, ${left ?? 0} ainda na fila, ${withTheme ?? 0} trechos ligados a um tema. Gasto: US$ ${spentDollars().toFixed(2)}.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
