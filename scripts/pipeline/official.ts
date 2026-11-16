// Comenta uma prova oficial (ENAMED/ENARE) e monta o lote para importação como rascunho.
// O enunciado, as alternativas e o gabarito são os da banca: aqui só se escreve o comentário,
// a classificação (área, tema, competência) e o material de estudo.
//
// Uso: npm run content:official -- <config.json> [--only=5,53] [--force]
//
// config.json:
// {
//   "exam": { ...OfficialExamSchema },
//   "slug_prefix": "enamed-2025",
//   "transcription": "caminho/transcricao.json",   // [{ n, stem, options, exams?, figure? }]
//   "key": "caminho/gabarito.json",                // { "1": "A", "2": "EXCLUIDA", "7": "ANULADA", "10": "ANULADA_ADM" }
//   "figures_dir": "content/media/enamed-2025",     // qNN.png para as questões com figura
//   "media_prefix": "enamed-2025",                  // caminho no bucket question-media
//   "output": "content/lots/enamed-2025-c1.json"
// }
//
// Etapas por questão: o modelo autor comenta a partir do gabarito oficial; outro modelo resolve às cegas
// e confere o comentário (uma rodada de correção se houver problema); as fontes novas só entram se o
// endereço responder. Divergência com o gabarito oficial não descarta a questão: ela vai para revisão
// médica com risco alto. O lote é regravado a cada questão, então dá para interromper e retomar.
import { config } from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { BlindAnswerSchema, LotSchema, type Lot, type Source } from "./schema";
import { lintDraft } from "./lint";
import { AUTHOR_MODEL, CHECK_MODEL, structured, type PromptImage } from "./llm";
import { acceptNewSources, buildQuestion, ConfigSchema, isAnnulled, LETTERS, OfficialCommentSchema, readFigure, TranscribedSchema, type OfficialComment, type Transcribed } from "./official-shared";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const CONCURRENCY = 4;

const CommentCheckSchema = z.object({
  verdicts: z.array(z.object({ statement: z.string(), correct: z.boolean(), note: z.string() })),
  explains_official_key: z.boolean().describe("O comentário defende o gabarito oficial de forma coerente."),
  dangerous_content: z.string().nullable(),
});

const COMMENT_RULES = `
Você escreve o comentário de uma questão de prova oficial de residência e formação médica no Brasil (ENAMED/ENARE), para estudantes.
- O enunciado, as alternativas e o gabarito são da banca. Não reescreva a questão.
- Ensine o raciocínio: por que a correta é a correta e o erro de cada alternativa errada.
- Base nas diretrizes brasileiras (Ministério da Saúde, PCDT, Cadernos de Atenção Básica) e de sociedades médicas. Não invente número, dose ou critério.
- Cada critério, dose ou recomendação usada vai em "claims", com a fonte. Use o catálogo quando servir; fora dele, proponha a fonte em "new_sources" só se tiver certeza de que o documento e o endereço existem.
- Se o gabarito oficial contrariar a diretriz atual, diga isso em "key_concern" e explique no comentário o que a banca considerou na época.
- Português do Brasil, claro e direto, sem markdown, asteriscos, hífens de lista ou cerquilhas: listas vão nos campos "items" e "sub".
- key_why liga os dados do caso à alternativa correta. theory é a revisão do tema para quem nunca estudou. summary é para revisar em 30 segundos.
`;

function questionText(q: Transcribed, keyLabel: string) {
  return [
    `<questao numero="${q.n}">`,
    q.stem,
    q.exams ? JSON.stringify(q.exams) : "",
    q.figure ? "(A questão traz a figura anexada.)" : "",
    q.options.map((o, i) => `${LETTERS[i]}. ${o}`).join("\n"),
    `</questao>`,
    `Gabarito oficial: ${keyLabel}`,
  ]
    .filter(Boolean)
    .join("\n");
}

type Outcome = { n: number; stage: string; reason: string };

async function comment(
  q: Transcribed,
  key: string,
  catalog: Source[],
  images: PromptImage[],
): Promise<{ draft?: OfficialComment; flags: string[]; rejected?: Outcome }> {
  const annulled = key.startsWith("ANULADA") || key === "EXCLUIDA";
  const keyIndex = annulled ? -1 : LETTERS.indexOf(key);
  const keyLabel = annulled
    ? "nenhum. A banca anulou ou excluiu esta questão; explique o tema e discuta cada alternativa sem apontar uma correta. Em distractors, comente todas as alternativas."
    : `${key} (${q.options[keyIndex]})`;
  const catalogText = catalog.map((s) => `${s.id}: ${s.title} (${s.publisher}, ${s.year})`).join("\n");
  const flags: string[] = [];

  const ask = (feedback?: string) =>
    structured(
      AUTHOR_MODEL,
      OfficialCommentSchema,
      COMMENT_RULES,
      `${questionText(q, keyLabel)}\n\n<catalogo_de_fontes>\n${catalogText}\n</catalogo_de_fontes>${feedback ? `\n\n<correcoes_do_revisor>\n${feedback}\n</correcoes_do_revisor>\nReescreva o comentário corrigindo esses pontos.` : ""}`,
      "high",
      images,
    );

  let draft = await ask();
  if (!draft) return { flags, rejected: { n: q.n, stage: "comentario", reason: "O modelo recusou ou a resposta foi cortada." } };

  // Resolução às cegas, por outro modelo: divergência vai para revisão médica, não descarta.
  if (!annulled) {
    const blind = await structured(
      CHECK_MODEL,
      BlindAnswerSchema,
      `Você é um médico experiente respondendo a uma prova. Responda com base nas diretrizes brasileiras. Índices de 0 a ${q.options.length - 1}.`,
      `${q.stem}${q.exams ? `\n${JSON.stringify(q.exams)}` : ""}\n\n${q.options.map((o, i) => `${LETTERS[i]}. ${o}`).join("\n")}`,
      "high",
      images,
    );
    if (blind && blind.answer_index !== keyIndex) flags.push(`resolução cega marcou ${LETTERS[blind.answer_index]}, banca ${key}`);
    if (blind?.other_defensible.length) flags.push(`outra alternativa defensável: ${blind.other_defensible.map((i) => LETTERS[i]).join(", ")}`);
  }
  if (draft.key_concern) flags.push(`autor questiona o gabarito: ${draft.key_concern}`);

  // Conferência do comentário, com uma rodada de correção.
  for (let round = 0; round < 2; round++) {
    const check = await structured(
      CHECK_MODEL,
      CommentCheckSchema,
      "Você revisa comentários de questões médicas para estudantes. Confira cada afirmação contra as diretrizes brasileiras atuais e o conhecimento médico consolidado. Marque como incorreta qualquer afirmação errada, desatualizada ou sem base.",
      `${questionText(q, keyLabel)}\n\n<comentario>\n${JSON.stringify({ ...draft, new_sources: undefined, image_alt: undefined })}\n</comentario>\n\nConfira cada critério, dose, número e recomendação do comentário (reasoning, distractors, tip, pearl, key_why, theory, summary). ${annulled ? "A questão foi anulada: confira só se o comentário não aponta uma resposta como certa." : "Diga se o comentário defende o gabarito oficial de forma coerente."} Aponte qualquer conteúdo que cause dano se um médico o seguir.`,
      "high",
      images,
    );
    if (!check) return { flags, rejected: { n: q.n, stage: "checagem", reason: "Sem resposta do verificador." } };
    const wrong = check.verdicts.filter((v) => !v.correct);
    const problems = [
      ...wrong.map((v) => `${v.statement}: ${v.note}`),
      ...(!annulled && !check.explains_official_key ? ["O comentário não sustenta o gabarito oficial de forma coerente."] : []),
      ...(check.dangerous_content ? [`Conteúdo perigoso: ${check.dangerous_content}`] : []),
    ];
    if (!problems.length) return { draft, flags };
    if (round === 1) return { flags, rejected: { n: q.n, stage: "checagem", reason: problems.join(" | ") } };
    const revised = await ask(problems.join("\n"));
    if (!revised) return { flags, rejected: { n: q.n, stage: "correcao", reason: "O modelo não reescreveu o comentário." } };
    draft = revised;
  }
  return { flags, rejected: { n: q.n, stage: "checagem", reason: "Sem conclusão." } };
}

async function main() {
  const args = process.argv.slice(2);
  const cfgPath = args.find((a) => !a.startsWith("--"));
  if (!cfgPath) throw new Error("Uso: content:official <config.json> [--only=5,53] [--force]");
  const cfg = ConfigSchema.parse(JSON.parse(readFileSync(cfgPath, "utf8")));
  const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",").map(Number);
  const force = args.includes("--force");

  const transcription = z.array(TranscribedSchema).parse(JSON.parse(readFileSync(cfg.transcription, "utf8")));
  const keys = z.record(z.string(), z.string()).parse(JSON.parse(readFileSync(cfg.key, "utf8")));
  const catalog: Source[] = cfg.catalog ? LotSchema.parse(JSON.parse(readFileSync(cfg.catalog, "utf8"))).sources : [];

  const reportPath = cfg.output.replace(/\.json$/, ".relatorio.json");
  const lot: Lot = existsSync(cfg.output)
    ? LotSchema.parse(JSON.parse(readFileSync(cfg.output, "utf8")))
    : { id: cfg.exam.id, notes: `${cfg.exam.name}${cfg.exam.booklet ? `, ${cfg.exam.booklet}` : ""}. Comentários gerados e conferidos por IA; revisão médica pendente.`, official_exam: cfg.exam, sources: [], questions: [] };
  const report: { rejected: Outcome[]; flags: Record<string, string[]>; dropped_sources: string[] } = existsSync(reportPath)
    ? JSON.parse(readFileSync(reportPath, "utf8"))
    : { rejected: [], flags: {}, dropped_sources: [] };

  const done = new Set(lot.questions.map((q) => q.official?.number));
  const queue = transcription.filter((q) => (!only || only.includes(q.n)) && (force || !done.has(q.n)));
  const today = new Date().toISOString().slice(0, 10);
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 2);
  const checkedUrls = new Map<string, boolean>();

  const save = () => {
    lot.questions.sort((a, b) => (a.official?.number ?? 0) - (b.official?.number ?? 0));
    writeFileSync(cfg.output, JSON.stringify(LotSchema.parse(lot), null, 2) + "\n");
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  };

  async function handle(q: Transcribed) {
    const key = keys[String(q.n)];
    if (!key) throw new Error(`Sem gabarito para a questão ${q.n}.`);
    const images = readFigure(q, cfg.figures_dir);
    const known = [...catalog, ...lot.sources];
    const result = await comment(q, key, known, images);
    report.rejected = report.rejected.filter((r) => r.n !== q.n);
    delete report.flags[String(q.n)];
    if (result.flags.length) report.flags[String(q.n)] = result.flags;
    if (!result.draft) {
      report.rejected.push(result.rejected!);
      console.log(`Q${q.n}: descartada (${result.rejected!.stage})`);
      return;
    }
    const draft = result.draft;

    // Fontes novas só entram com o endereço respondendo.
    const added = await acceptNewSources(draft, known, checkedUrls, today, `Q${q.n}`);
    lot.sources.push(...added.accepted);
    report.dropped_sources.push(...added.dropped);
    const valid = new Set([...catalog, ...lot.sources].map((s) => s.id));
    const claims = draft.claims.filter((c) => valid.has(c.source_id));
    for (const id of new Set(claims.map((c) => c.source_id))) {
      const fromCatalog = catalog.find((s) => s.id === id);
      if (fromCatalog && !lot.sources.some((s) => s.id === id)) lot.sources.push(fromCatalog);
    }
    if (!claims.length) {
      report.rejected.push({ n: q.n, stage: "fontes", reason: "Nenhuma fonte verificável sustentou o comentário." });
      console.log(`Q${q.n}: descartada (fontes)`);
      return;
    }

    const annulled = isAnnulled(key);
    // Divergência ou dúvida sobre o gabarito: entra primeiro na amostra da revisão médica.
    const question = buildQuestion({ q, key, draft, claims, cfg, priority: result.flags.length > 0 });
    const lint = lintDraft(question, { official: { annulled } }).filter((i) => i.fatal);
    if (lint.length) {
      report.rejected.push({ n: q.n, stage: "escrita", reason: lint.map((i) => i.message).join(" ") });
      console.log(`Q${q.n}: descartada (escrita)`);
      return;
    }
    lot.questions = lot.questions.filter((x) => x.official?.number !== q.n);
    lot.questions.push(question);
    save();
    console.log(`Q${q.n}: ok${result.flags.length ? ` (revisar: ${result.flags.join("; ")})` : ""}`);
  }

  let next = 0;
  async function worker() {
    while (next < queue.length) {
      const q = queue[next++];
      try {
        await handle(q);
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError) throw error;
        // Sem crédito, todas as próximas chamadas falham: para logo em vez de marcar a prova inteira como erro.
        if (error instanceof Anthropic.APIError && /credit balance/i.test(error.message)) {
          next = queue.length;
          console.error(`Q${q.n}: sem crédito na API. Parando; rode de novo depois de recarregar.`);
          return;
        }
        const reason = error instanceof Anthropic.APIError ? `API ${error.status}: ${error.message}` : String(error);
        report.rejected = report.rejected.filter((r) => r.n !== q.n);
        report.rejected.push({ n: q.n, stage: "erro", reason });
        console.error(`Q${q.n}: erro (${reason})`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  save();
  console.log(`\n${lot.questions.length} questões no lote, ${report.rejected.length} descartadas, ${Object.keys(report.flags).length} para revisar com prioridade.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
