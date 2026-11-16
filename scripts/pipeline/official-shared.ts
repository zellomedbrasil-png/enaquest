// Parte comum da prova oficial: usada pelo gerador por API (official.ts) e pelo montador local
// (scripts/content/assemble-official.ts). Nada aqui chama a API.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { AREA_IDS, COMPETENCY_IDS, DIFFICULTIES, OfficialExamSchema, SourceSchema, StudyExtrasSchema, type LotQuestion, type Source } from "./schema";

export const LETTERS = "ABCDE";

export const ConfigSchema = z.object({
  exam: OfficialExamSchema,
  slug_prefix: z.string().regex(/^[a-z0-9-]+$/),
  transcription: z.string(),
  key: z.string(),
  figures_dir: z.string(),
  media_prefix: z.string(),
  output: z.string(),
  /** Catálogo de fontes verificadas, compartilhado entre as provas. */
  catalog: z.string().optional(),
  /** Pasta com um comentário por questão (qNN.json), escrito localmente. */
  comments_dir: z.string().optional(),
});
export type OfficialConfig = z.infer<typeof ConfigSchema>;

export const TranscribedSchema = z.object({
  n: z.number().int().positive(),
  stem: z.string().min(10),
  options: z.array(z.string().min(1)).min(4).max(5),
  exams: z.array(z.object({ title: z.string(), rows: z.array(z.array(z.string())) })).nullable().optional(),
  figure: z.boolean().optional(),
});
export type Transcribed = z.infer<typeof TranscribedSchema>;

/** Comentário de uma questão oficial: classificação, comentário, material de estudo e fontes. */
export const OfficialCommentSchema = StudyExtrasSchema.extend({
  area_id: z.enum(AREA_IDS),
  competency_id: z.enum(COMPETENCY_IDS),
  theme: z.string().describe("Tema da questão em até 6 palavras, como 'Insuficiência cardíaca com FE reduzida'."),
  scenario: z.string().describe("Onde o caso acontece, em até 3 palavras: UBS, UPA, Pronto-socorro, Enfermaria, Ambulatório, Sala de parto, Pré-hospitalar."),
  difficulty: z.enum(DIFFICULTIES),
  quick: z.string().describe("A resposta e o motivo central em até 40 palavras."),
  reasoning: z.string().describe("Raciocínio clínico passo a passo, do caso até a resposta."),
  distractors: z.array(z.object({ index: z.number(), why: z.string() })).describe("Uma entrada para cada alternativa errada, explicando o erro."),
  tip: z.string().describe("Macete de prova, em até 30 palavras."),
  pearl: z.string().describe("Armadilha clássica sobre o tema, em até 40 palavras."),
  competency_note: z.string().describe("O que a prova quis avaliar, em até 30 palavras."),
  claims: z
    .array(z.object({ claim: z.string(), source_id: z.string(), locator: z.string() }))
    .describe("Cada critério, dose, número ou recomendação usada no comentário, com a fonte que a sustenta."),
  new_sources: z
    .array(z.object({ id: z.string(), title: z.string(), publisher: z.string(), year: z.number(), url: z.string() }))
    .describe("Fontes citadas em claims que não estão no catálogo. Só documentos oficiais ou diretrizes de sociedades, com endereço que você sabe que existe."),
  image_alt: z.string().nullable().describe("Se há figura: descrição objetiva para leitor de tela, sem entregar o diagnóstico. Null se não há figura."),
  key_concern: z.string().nullable().describe("Se você acha que o gabarito oficial está errado ou ficou desatualizado, explique. Null se concorda."),
});
export type OfficialComment = z.infer<typeof OfficialCommentSchema>;

/**
 * Comentário escrito localmente (um arquivo por questão). Igual ao da API, com os campos de
 * apoio opcionais, e "review_note" para o que um médico precisa olhar.
 */
export const LocalCommentSchema = OfficialCommentSchema.extend({
  // Questão anulada não tem alternativa correta, então não há "por que a correta é correta".
  key_why: z.string().optional(),
  new_sources: OfficialCommentSchema.shape.new_sources.default([]),
  image_alt: OfficialCommentSchema.shape.image_alt.default(null),
  key_concern: OfficialCommentSchema.shape.key_concern.default(null),
  review_note: z.string().nullable().default(null),
});
export type LocalComment = z.infer<typeof LocalCommentSchema>;

/** Comentário sem exigir key_why (questão anulada não tem). */
export type CommentLike = Omit<OfficialComment, "key_why"> & { key_why?: string };

export const isAnnulled = (key: string) => key.startsWith("ANULADA") || key === "EXCLUIDA";

export function annulledNote(key: string): string | undefined {
  if (key === "EXCLUIDA") return "Excluída pelo Inep do cálculo dos resultados por desajuste ao modelo estatístico (gabarito definitivo).";
  if (key === "ANULADA_ADM") return "Anulada administrativamente pelo Inep desde o gabarito preliminar, por erro material na redação entre os cadernos 01 e 02.";
  if (key.startsWith("ANULADA")) return "Anulada pela banca no gabarito definitivo.";
  return undefined;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function figureFile(dir: string, n: number): string {
  return join(dir, `q${pad(n)}.png`);
}

export function readFigure(q: Transcribed, dir: string) {
  if (!q.figure) return [];
  const file = figureFile(dir, q.n);
  if (!existsSync(file)) throw new Error(`Figura da questão ${q.n} não encontrada em ${file}.`);
  return [{ mediaType: "image/png" as const, base64: readFileSync(file).toString("base64") }];
}

/** Monta a questão do lote. Texto, alternativas e gabarito são os da banca; o comentário vem de fora. */
export function buildQuestion(opts: {
  q: Transcribed;
  key: string;
  draft: CommentLike;
  claims: CommentLike["claims"];
  cfg: Pick<OfficialConfig, "slug_prefix" | "media_prefix">;
  priority: boolean;
}): LotQuestion {
  const { q, key, draft, claims, cfg, priority } = opts;
  const annulled = isAnnulled(key);
  const keyIndex = annulled ? -1 : LETTERS.indexOf(key);
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 2);
  return {
    stem: q.stem,
    exams: q.exams ?? null,
    options: q.options,
    correct_index: annulled ? 0 : keyIndex,
    quick: draft.quick,
    reasoning: draft.reasoning,
    distractors: annulled ? draft.distractors : draft.distractors.filter((d) => d.index !== keyIndex),
    tip: draft.tip,
    pearl: draft.pearl,
    competency_note: draft.competency_note,
    claims,
    key_why: annulled ? undefined : draft.key_why,
    theory: draft.theory,
    summary: draft.summary,
    images: q.figure
      ? [{ src: `${cfg.media_prefix}/q${pad(q.n)}.png`, alt: draft.image_alt ?? `Figura da questão ${q.n}`, caption: `Figura da questão ${q.n}.` }]
      : undefined,
    official: { number: q.n, annulled, annulled_note: annulledNote(key) },
    slug: `${cfg.slug_prefix}-q${pad(q.n)}`,
    area_id: draft.area_id,
    competency_id: draft.competency_id,
    theme: draft.theme,
    scenario: draft.scenario,
    difficulty: draft.difficulty,
    risk_level: priority ? "alto" : "normal",
    expires_on: expires.toISOString().slice(0, 10),
  };
}

// ---------- Conferência de fontes (HTTP, sem custo) ----------

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3),
  );
}

/** O título registrado no Crossref precisa bater com o título citado (evita DOI certo com documento trocado). */
async function doiTitleMatches(doi: string, title: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.crossref.org/works/${doi}`, { signal: AbortSignal.timeout(20_000) });
    if (response.status === 404) return true; // DOI de outra agência (DataCite): fica a checagem do registro.
    if (!response.ok) return false;
    const body = (await response.json()) as { message?: { title?: string[] } };
    const registered = words((body.message?.title ?? []).join(" "));
    const cited = words(title);
    if (!registered.size || !cited.size) return false;
    const shared = [...cited].filter((w) => registered.has(w)).length;
    return shared / Math.min(cited.size, registered.size) >= 0.5;
  } catch {
    return false;
  }
}

export async function urlWorks(url: string, title = ""): Promise<boolean> {
  // DOI: confere no registro do doi.org, porque as revistas costumam bloquear acesso automatizado.
  const doi = url.match(/^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i)?.[1];
  if (doi) {
    try {
      const response = await fetch(`https://doi.org/api/handles/${doi}`, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) return false;
      const body = (await response.json()) as { responseCode?: number };
      return body.responseCode === 1 && (await doiTitleMatches(doi, title));
    } catch {
      return false;
    }
  }
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "Mozilla/5.0 (EnaQuest verificador de fontes)" } });
    return response.status < 400;
  } catch {
    return false;
  }
}

/**
 * Aceita as fontes novas de um comentário: só entram se o endereço responder. Devolve as que entraram
 * (já no formato do lote) e as recusadas, para o relatório.
 */
export async function acceptNewSources(
  draft: Pick<CommentLike, "new_sources">,
  known: Source[],
  cache: Map<string, boolean>,
  today: string,
  label: string,
): Promise<{ accepted: Source[]; dropped: string[] }> {
  const accepted: Source[] = [];
  const dropped: string[] = [];
  for (const source of draft.new_sources) {
    if (known.some((s) => s.id === source.id) || accepted.some((s) => s.id === source.id)) continue;
    if (!cache.has(source.url)) cache.set(source.url, await urlWorks(source.url, source.title));
    const parsed = SourceSchema.safeParse({ ...source, checked_on: today });
    if (cache.get(source.url) && parsed.success) accepted.push(parsed.data);
    else dropped.push(`${label}: ${source.title} (${source.url})`);
  }
  return { accepted, dropped };
}
