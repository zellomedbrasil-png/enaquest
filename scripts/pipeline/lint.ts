// Checagens automáticas de escrita. Não dependem de IA, então valem para qualquer questão.
import type { Draft, Lot } from "./schema";

export type LintIssue = { code: string; message: string; fatal: boolean };

const BANNED_OPTION = /\b(todas as (anteriores|alternativas)|nenhuma das (anteriores|alternativas)|todas estão|nenhuma está)\b/i;
const LETTER_PREFIX = /^\s*\(?[A-Ea-e][).:-]\s/;
const ABSOLUTE = /\b(sempre|nunca|jamais|exclusivamente|obrigatoriamente)\b/i;
const QUESTION_END = /[?:]\s*$|\b(é|são|consiste em|deve ser|por|de|em)\s*$/;
const FORBIDDEN_MARKS = /[*_#`]{2,}/;

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function lintDraft(draft: Draft, options: { expectedOptions?: number } = {}): LintIssue[] {
  const expected = options.expectedOptions ?? 4;
  const issues: LintIssue[] = [];
  const fatal = (code: string, message: string) => issues.push({ code, message, fatal: true });
  const warn = (code: string, message: string) => issues.push({ code, message, fatal: false });

  if (draft.options.length !== expected) fatal("options_count", `Precisa de ${expected} alternativas; veio ${draft.options.length}.`);
  if (!Number.isInteger(draft.correct_index) || draft.correct_index < 0 || draft.correct_index >= draft.options.length) {
    fatal("key_range", "O gabarito aponta para uma alternativa inexistente.");
  }

  const normalized = draft.options.map((o) => o.trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) fatal("options_duplicate", "Há alternativas repetidas.");
  for (const option of draft.options) {
    if (BANNED_OPTION.test(option)) fatal("option_banned", `Alternativa proibida: "${option}".`);
    if (LETTER_PREFIX.test(option)) fatal("option_letter", `A alternativa não pode começar com letra: "${option}".`);
    if (!option.trim()) fatal("option_empty", "Alternativa vazia.");
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

  const wrongIndexes = draft.options.map((_, i) => i).filter((i) => i !== draft.correct_index);
  const explained = new Set(draft.distractors.map((d) => d.index));
  for (const index of wrongIndexes) {
    if (!explained.has(index)) fatal("distractor_missing", `Falta explicar a alternativa ${"ABCD"[index]}.`);
  }
  if (explained.has(draft.correct_index)) fatal("distractor_key", "A alternativa correta não pode estar entre as erradas.");
  for (const d of draft.distractors) {
    if (words(d.why) < 5) warn("distractor_thin", `Explicação rasa para a alternativa ${"ABCD"[d.index]}.`);
  }

  if (!draft.claims.length) fatal("no_claims", "Sem fonte, a questão não entra.");
  for (const claim of draft.claims) {
    if (!claim.source_id) fatal("claim_no_source", `Afirmação sem fonte: "${claim.claim}".`);
  }

  for (const field of ["quick", "reasoning", "tip", "pearl", "competency_note"] as const) {
    if (words(draft[field]) < 4) fatal("explanation_empty", `Campo "${field}" vazio ou raso.`);
  }
  return issues;
}

/** Evita que o gabarito caia sempre na mesma letra dentro de um lote. */
export function keyBalance(lot: Pick<Lot, "questions">): { counts: number[]; balanced: boolean } {
  const counts = [0, 0, 0, 0];
  for (const q of lot.questions) counts[q.correct_index] += 1;
  const expected = lot.questions.length / 4;
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
  const report = lot.questions.map((question) => {
    const issues = lintDraft(question);
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
