// Gerador diário: escreve questões novas pelo OpenRouter, checa e publica no banco.
// Roda todo dia no GitHub Actions (.github/workflows/questoes-diarias.yml).
//
// Uso:
//   npm run content:diario                    (quantidade de QUESTOES_POR_DIA, padrão 20)
//   npm run content:diario -- --quantidade=5
//   npm run content:diario -- --simular       (gera e checa, sem gravar no banco)
//
// Variáveis: OPENROUTER_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// QUESTOES_POR_DIA (20), QUESTOES_LIMITE_DOLARES (3), QUESTOES_MODELO_* (ver scripts/pipeline/llm.ts).
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AuthorDraftSchema, LotSchema, SourceSchema, type LotQuestion, type Source } from "./pipeline/schema";
import { lintDraft, lintLot } from "./pipeline/lint";
import { AUTHOR_MODEL, CHECK_MODEL, SECOND_MODEL, isFatalApiError, spentDollars, structured } from "./pipeline/llm";
import { STYLE_RULES_FROM_KNOWLEDGE } from "./pipeline/style";
import { checkWithoutSources } from "./pipeline/checks";
import { planDay, TemarioSchema, type PlanItem } from "./pipeline/daily-plan";
import { importLot } from "./content/import";

config({ path: ".env.local", quiet: true });

const AREA_NAMES: Record<string, string> = {
  clinica: "Clínica Médica",
  pediatria: "Pediatria",
  go: "Ginecologia e Obstetrícia",
  cirurgia: "Cirurgia Geral",
  mental: "Saúde Mental",
  coletiva: "Saúde Coletiva",
  mfc: "Medicina de Família e Comunidade",
};

const slugify = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

async function draft(item: PlanItem, sources: Source[]) {
  const list = sources.length
    ? sources.map((s) => `- ${s.id}: ${s.title} (${s.publisher}, ${s.year})`).join("\n")
    : "(nenhuma fonte do catálogo para este tema; deixe \"claims\" vazio)";
  return structured(
    AUTHOR_MODEL,
    AuthorDraftSchema,
    `Você é médico e escreve questões originais de múltipla escolha para estudantes que se preparam para o ENAMED e o ENARE (acesso direto), no padrão da prova do Inep.\n${STYLE_RULES_FROM_KNOWLEDGE}`,
    `Escreva uma questão original.\n\nÁrea: ${AREA_NAMES[item.area_id]}\nTema: ${item.theme}\nCompetência avaliada: ${item.competency_id}\nCenário: ${item.scenario}\nDificuldade: ${item.difficulty}\n\nEm "claims", liste cada dose, número, critério ou recomendação usada, citando o source_id de uma destas fontes só quando ela de fato sustentar a afirmação. Não use outros ids.\n<fontes>\n${list}\n</fontes>`,
    "high",
  );
}

type Outcome = { theme: string; area: string; status: "ok" | "precisa de olho" | "descartada" | "erro"; reason?: string };

async function main() {
  const simulate = process.argv.includes("--simular");
  const size = Number(arg("quantidade") || process.env.QUESTOES_POR_DIA || 20);
  const budget = Number(process.env.QUESTOES_LIMITE_DOLARES || 3);
  if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.log("::warning::Sem OPENROUTER_API_KEY: nenhuma questão foi gerada hoje.");
    return;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!simulate && (!url || !key)) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  const db = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;

  const today = new Date().toISOString().slice(0, 10);
  const temario = TemarioSchema.parse(JSON.parse(readFileSync("content/temas/temario.json", "utf8")));
  const catalog = z.object({ sources: z.array(SourceSchema) }).parse(JSON.parse(readFileSync("content/sources/catalogo.json", "utf8"))).sources;
  const byId = new Map(catalog.map((s) => [s.id, s]));

  // Quantas questões cada tema já rendeu, para hoje cobrir os menos usados.
  const usage: Record<string, number> = {};
  if (db) {
    const { data, error } = await db.from("questions").select("theme").like("lot_id", "diario-%").limit(20000);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) usage[row.theme] = (usage[row.theme] ?? 0) + 1;
  }
  const plan = planDay(temario, usage, size, today);
  console.log(`Plano de ${today}: ${plan.length} questões. Autor ${AUTHOR_MODEL}, verificador ${CHECK_MODEL}, segunda opinião ${SECOND_MODEL}.`);

  const questions: LotQuestion[] = [];
  const outcomes: Outcome[] = [];
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 2);

  for (const item of plan) {
    if (spentDollars() >= budget) {
      console.log(`Limite de US$ ${budget} atingido. Parando por hoje.`);
      break;
    }
    const sources = item.source_ids.map((id) => byId.get(id)).filter((s): s is Source => Boolean(s));
    const record = (status: Outcome["status"], reason?: string) => {
      outcomes.push({ theme: item.theme, area: item.area_id, status, reason });
      console.log(`[${item.area_id}] ${item.theme}: ${status}${reason ? ` (${reason})` : ""}`);
    };
    try {
      // Duas tentativas: rascunho recusado ou com erro de escrita não custa caro para refazer.
      let written = null;
      for (let attempt = 0; attempt < 2 && !written; attempt++) {
        const candidate = await draft(item, sources);
        if (candidate && !lintDraft(candidate).some((issue) => issue.fatal)) written = candidate;
      }
      if (!written) {
        record("descartada", "rascunho recusado ou com erro de escrita");
        continue;
      }
      // Fonte citada fora do catálogo do tema não entra.
      const valid = new Set(sources.map((s) => s.id));
      const claims = written.claims.filter((c) => valid.has(c.source_id));

      const verdict = await checkWithoutSources(written, item.risk_level, "generated");
      if (!verdict.ok && !verdict.hold) {
        record("descartada", `${verdict.stage}: ${verdict.reason}`);
        continue;
      }
      questions.push({
        ...written,
        claims,
        slug: `${item.area_id}-${slugify(item.theme)}-${today}-${randomBytes(2).toString("hex")}`,
        area_id: item.area_id,
        competency_id: item.competency_id,
        theme: item.theme,
        scenario: item.scenario,
        difficulty: item.difficulty,
        risk_level: item.risk_level,
        expires_on: expires.toISOString().slice(0, 10),
        ...(verdict.ok ? {} : { hold_reason: `${verdict.stage}: ${verdict.reason}` }),
      });
      record(verdict.ok ? "ok" : "precisa de olho", verdict.ok ? undefined : verdict.reason);
    } catch (error) {
      if (isFatalApiError(error)) throw error;
      record("erro", error instanceof Error ? error.message : String(error));
    }
  }

  const cost = `US$ ${spentDollars().toFixed(2)}`;
  if (!questions.length) throw new Error(`Nenhuma questão aproveitada hoje (${outcomes.length} tentativas, ${cost}).`);

  const used = new Set(questions.flatMap((q) => q.claims.map((c) => c.source_id)));
  const lot = LotSchema.parse({
    id: `diario-${today}`,
    notes: `Gerado automaticamente em ${today}. Autor ${AUTHOR_MODEL}; checagem ${CHECK_MODEL}; segunda opinião ${SECOND_MODEL}.`,
    sources: catalog.filter((s) => used.has(s.id)),
    questions,
  });
  const report = lintLot(lot);

  mkdirSync("content/lots/diario", { recursive: true });
  writeFileSync(`content/lots/diario/${today}.json`, JSON.stringify(lot, null, 2) + "\n");
  writeFileSync(`content/lots/diario/${today}.relatorio.json`, JSON.stringify({ cost: spentDollars(), outcomes, lint: report }, null, 2) + "\n");

  const held = questions.filter((q) => q.hold_reason).length;
  const discarded = outcomes.filter((o) => o.status === "descartada" || o.status === "erro").length;
  if (simulate || !db) {
    console.log(`\nSimulação: ${questions.length - held} iriam ao ar, ${held} precisam de olho, ${discarded} descartadas. Custo: ${cost}.`);
    return;
  }
  const summary = await importLot(db, lot, { publish: true });
  console.log(`\nLote ${lot.id}: ${summary.published} no ar, ${summary.held} precisam de olho no /admin, ${discarded} descartadas. Custo: ${cost}.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
