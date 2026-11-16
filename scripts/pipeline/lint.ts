// Checagens automáticas de escrita. Não dependem de IA, então valem para qualquer questão.
import type { Draft, Lot, StudyExtras } from "./schema";
import { SummarySchema, TheorySchema } from "../../src/lib/study/content";

export type LintIssue = { code: string; message: string; fatal: boolean };

const BANNED_OPTION = /\b(todas as (anteriores|alternativas)|nenhuma das (anteriores|alternativas)|todas estão|nenhuma está)\b/i;
const LETTER_PREFIX = /^\s*\(?[A-Ea-e][).:-]\s/;
const ABSOLUTE = /\b(sempre|nunca|jamais|exclusivamente|obrigatoriamente)\b/i;
const QUESTION_END = /[?:]\s*$|\b(é|são|consiste em|deve ser|por|de|em)\s*$/;
const FORBIDDEN_MARKS = /[*_#`]{2,}/;

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Questão oficial: o texto é o da banca, então as regras de estilo da escrita autoral não valem.
 * Continuam valendo a estrutura (alternativas, gabarito), o comentário e as fontes.
 */
export type OfficialLint = { annulled: boolean };

export function lintDraft(
  draft: Draft & Partial<StudyExtras>,
  options: { expectedOptions?: number; official?: OfficialLint } = {},
): LintIssue[] {
  const official = options.official;
  const issues: LintIssue[] = [];
  const fatal = (code: string, message: string) => issues.push({ code, message, fatal: true });
  const warn = (code: string, message: string) => issues.push({ code, message, fatal: false });

  if (official) {
    if (draft.options.length < 4 || draft.options.length > 5) fatal("options_count", `Prova oficial tem 4 ou 5 alternativas; veio ${draft.options.length}.`);
  } else {
    const expected = options.expectedOptions ?? 4;
    if (draft.options.length !== expected) fatal("options_count", `Precisa de ${expected} alternativas; veio ${draft.options.length}.`);
  }
  if (!Number.isInteger(draft.correct_index) || draft.correct_index < 0 || draft.correct_index >= draft.options.length) {
    fatal("key_range", "O gabarito aponta para uma alternativa inexistente.");
  }

  const normalized = draft.options.map((o) => o.trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) fatal("options_duplicate", "Há alternativas repetidas.");
  for (const option of draft.options) {
    if (!official && BANNED_OPTION.test(option)) fatal("option_banned", `Alternativa proibida: "${option}".`);
    if (LETTER_PREFIX.test(option)) fatal("option_letter", `A alternativa não pode começar com letra: "${option}".`);
    if (!option.trim()) fatal("option_empty", "Alternativa vazia.");
  }

  if (official) {
    if (!draft.stem.trim()) fatal("stem_empty", "Enunciado vazio.");
    lintComment(draft, official.annulled, fatal, warn);
    return issues;
  }

  const stemWords = words(draft.stem);
  if (stemWords < 15) warn("stem_short", "Enunciado muito curto para o estilo da prova.");
  if (stemWords > 220) warn("stem_long", "Enunciado muito longo para o estilo da prova.");
  if (!QUESTION_END.test(draft.stem)) fatal("stem_no_question", "O enunciado precisa terminar em uma pergunta.");
  if (FORBIDDEN_MARKS.test(draft.stem)) fatal("markdown", "O enunciado não pode ter marcação.");

  // Pista clássica: a alternativa certa é muito mais longa que as outras.
  const lengths = draft.options.map((o) => o.length);
  const others = lengths.filter((_, i) => i !== draft.correct_index);
  const longest = Math.max(...others, 1);
  if (lengths[draft.correct_index] > longest * 1.6 && lengths[draft.correct_index] > 40) {
    fatal("key_longest", "A alternativa correta é bem mais longa que as demais, o que vira pista.");
  }

  // Pista clássica: só as erradas usam termos absolutos.
  const absoluteWrong = draft.options.filter((o, i) => i !== draft.correct_index && ABSOLUTE.test(o)).length;
  if (absoluteWrong >= 2 && !ABSOLUTE.test(draft.options[draft.correct_index] ?? "")) {
    warn("absolute_terms", "Termos absolutos só nas alternativas erradas podem virar pista.");
  }

  lintComment(draft, false, fatal, warn);
  return issues;
}

/** Comentário, fontes e material de estudo: valem para questão autoral e oficial. */
function lintComment(
  draft: Draft & Partial<StudyExtras>,
  annulled: boolean,
  fatal: (code: string, message: string) => void,
  warn: (code: string, message: string) => void,
) {
  // Na anulada não há gabarito válido, então não se cobra explicação por alternativa errada.
  if (!annulled) {
    const wrongIndexes = draft.options.map((_, i) => i).filter((i) => i !== draft.correct_index);
    const explained = new Set(draft.distractors.map((d) => d.index));
    for (const index of wrongIndexes) {
      if (!explained.has(index)) fatal("distractor_missing", `Falta explicar a alternativa ${"ABCDE"[index]}.`);
    }
    if (explained.has(draft.correct_index)) fatal("distractor_key", "A alternativa correta não pode estar entre as erradas.");
  }
  for (const d of draft.distractors) {
    if (words(d.why) < 5) warn("distractor_thin", `Explicação rasa para a alternativa ${"ABCDE"[d.index]}.`);
  }

  if (!draft.claims.length) fatal("no_claims", "Sem fonte, a questão não entra.");
  for (const claim of draft.claims) {
    if (!claim.source_id) fatal("claim_no_source", `Afirmação sem fonte: "${claim.claim}".`);
  }

  for (const field of ["quick", "reasoning", "tip", "pearl", "competency_note"] as const) {
    if (words(draft[field]) < 4) fatal("explanation_empty", `Campo "${field}" vazio ou raso.`);
  }
  for (const issue of lintExtras(draft)) (issue.fatal ? fatal : warn)(issue.code, issue.message);
}

/** Material de estudo extra (opcional): formato, tamanho e ausência de marcação. */
export function lintExtras(extras: Partial<StudyExtras>): LintIssue[] {
  const issues: LintIssue[] = [];
  const fatal = (code: string, message: string) => issues.push({ code, message, fatal: true });
  if (extras.key_why !== undefined) {
    const n = words(extras.key_why);
    if (n < 8) fatal("key_why_thin", "O comentário da alternativa correta está raso.");
    if (n > 110) fatal("key_why_long", "O comentário da alternativa correta está longo demais.");
  }
  if (extras.theory !== undefined) {
    const parsed = TheorySchema.safeParse(extras.theory);
    if (!parsed.success) fatal("theory_shape", `Revisão do tema fora do formato: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
    if (words(JSON.stringify(extras.theory)) > 480) fatal("theory_long", "Revisão do tema longa demais.");
  }
  if (extras.summary !== undefined) {
    const parsed = SummarySchema.safeParse(extras.summary);
    if (!parsed.success) fatal("summary_shape", `Resumo fora do formato: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
  }
  for (const text of [extras.key_why, extras.theory && JSON.stringify(extras.theory), extras.summary && JSON.stringify(extras.summary)]) {
    if (text && (FORBIDDEN_MARKS.test(text) || /(^|\n|\\n|")\s*[-*•#]\s/.test(text))) fatal("markdown", "O material de estudo não pode ter marcação.");
  }
  return issues;
}

/** Evita que o gabarito caia sempre na mesma letra dentro de um lote. */
export function keyBalance(lot: Pick<Lot, "questions">): { counts: number[]; balanced: boolean } {
  const counts = [0, 0, 0, 0];
  for (const q of lot.questions) counts[q.correct_index] = (counts[q.correct_index] ?? 0) + 1;
  const expected = lot.questions.length / counts.length;
  return { counts, balanced: counts.every((c) => c >= expected * 0.5 && c <= expected * 1.6) };
}

function shingles(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const out = new Set<string>();
  for (let i = 0; i < tokens.length - 2; i++) out.add(tokens.slice(i, i + 3).join(" "));
  return out;
}

export function similarity(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const s of A) if (B.has(s)) shared += 1;
  return shared / (A.size + B.size - shared);
}

/** Pares de questões parecidas demais. */
export function findDuplicates(items: { slug: string; stem: string }[], threshold = 0.35): [string, string, number][] {
  const out: [string, string, number][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const score = similarity(items[i].stem, items[j].stem);
      if (score >= threshold) out.push([items[i].slug, items[j].slug, score]);
    }
  }
  return out;
}

export function lintLot(lot: Lot) {
  const known = new Set(lot.sources.map((s) => s.id));
  const isOfficial = Boolean(lot.official_exam);
  const numbers = lot.questions.map((q) => q.official?.number);
  const report = lot.questions.map((question) => {
    const issues = lintDraft(question, isOfficial ? { official: { annulled: question.official?.annulled ?? false } } : {});
    if (isOfficial && !question.official) {
      issues.push({ code: "official_missing", message: "Lote de prova oficial: falta o número da questão no caderno.", fatal: true });
    }
    if (!isOfficial && question.official) {
      issues.push({ code: "official_without_exam", message: "Questão com número oficial em lote sem official_exam.", fatal: true });
    }
    if (question.official && numbers.indexOf(question.official.number) !== numbers.lastIndexOf(question.official.number)) {
      issues.push({ code: "official_number_repeated", message: `Número ${question.official.number} repetido no caderno.`, fatal: true });
    }
    if (question.official?.annulled && !question.official.annulled_note) {
      issues.push({ code: "annulled_no_note", message: "Questão anulada precisa explicar o motivo da anulação.", fatal: true });
    }
    for (const claim of question.claims) {
      if (!known.has(claim.source_id)) {
        issues.push({ code: "unknown_source", message: `Fonte não cadastrada: ${claim.source_id}.`, fatal: true });
      }
    }
    return { slug: question.slug, issues };
  });
  const slugs = lot.questions.map((q) => q.slug);
  return {
    report,
    fatalCount: report.reduce((sum, r) => sum + r.issues.filter((i) => i.fatal).length, 0),
    duplicateSlugs: slugs.filter((s, i) => slugs.indexOf(s) !== i),
    duplicates: findDuplicates(lot.questions),
    keys: keyBalance(lot),
  };
}
