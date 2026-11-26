// Checagens automáticas que decidem se uma questão vai ao ar sozinha.
// Três resultados possíveis: passa, fica fora do ar "precisando de olho" (hold) ou é descartada.
import type { z } from "zod";
import { BlindAnswerSchema, FactCheckSchema, SafetyReviewSchema, type Draft } from "./schema";
import { CHECK_MODEL, SECOND_MODEL, structured } from "./llm";

export type Verdict = { ok: true } | { ok: false; hold: boolean; stage: string; reason: string };

const pass: Verdict = { ok: true };
const discard = (stage: string, reason: string): Verdict => ({ ok: false, hold: false, stage, reason });
const hold = (stage: string, reason: string): Verdict => ({ ok: false, hold: true, stage, reason });

type Question = Pick<Draft, "stem" | "exams" | "options" | "correct_index">;

export async function blindSolve(question: Question, model = CHECK_MODEL) {
  const options = question.options.map((o, i) => `${"ABCD"[i]}. ${o}`).join("\n");
  const exams = question.exams ? `\n${JSON.stringify(question.exams)}` : "";
  return structured(
    model,
    BlindAnswerSchema,
    "Você é um médico experiente respondendo a uma prova. Responda com base nas diretrizes brasileiras vigentes. Índices de 0 a 3.",
    `${question.stem}${exams}\n\n${options}`,
    "high",
  );
}

export async function factCheck(draft: Draft, sourceText: string) {
  return structured(
    CHECK_MODEL,
    FactCheckSchema,
    "Você revisa conteúdo médico educacional. Marque como sustentada apenas a afirmação que está de fato nas fontes fornecidas. Conhecimento próprio não conta como sustentação.",
    `<fontes>\n${sourceText}\n</fontes>\n\n<questao>\n${JSON.stringify(draft)}\n</questao>\n\nConfira cada item de "claims" e também os campos key_why, theory e summary: cada número, dose, critério ou recomendação neles entra em "verdicts" e só é sustentado se estiver nas fontes. Diga se o gabarito está correto e aponte qualquer conteúdo que possa causar dano se um médico o seguisse.`,
    "high",
  );
}

async function safetyReview(question: Draft) {
  return structured(
    CHECK_MODEL,
    SafetyReviewSchema,
    "Você revisa conteúdo médico educacional para estudantes que se preparam para o ENAMED. Use as diretrizes brasileiras vigentes. Na dúvida, aponte o problema.",
    `<questao>\n${JSON.stringify(question)}\n</questao>\n\nO gabarito está correto? Há alguma dose, número, critério ou recomendação errada ou desatualizada? Há conteúdo que possa causar dano se um médico o seguisse?`,
    "high",
  );
}

/** Resultado de uma resolução às cegas comparado ao gabarito. */
export function judgeBlind(blind: z.infer<typeof BlindAnswerSchema> | null, correct: number, stage: string, strict: boolean): Verdict {
  const fail = strict ? discard : hold;
  if (!blind) return hold(stage, "Sem resposta do verificador.");
  if (blind.answer_index !== correct) return fail(stage, `Respondeu ${"ABCD"[blind.answer_index] ?? "?"}, gabarito ${"ABCD"[correct]}.`);
  if (blind.other_defensible.length) return fail(stage, "Mais de uma alternativa pode ser defendida.");
  if (blind.stem_problem) return fail(stage, blind.stem_problem);
  if (!blind.confident) return hold(stage, "O verificador acertou, mas sem segurança.");
  return pass;
}

/**
 * Alto risco (doses, condutas, vacinas): segunda resolução às cegas, por outro modelo.
 * Qualquer discordância deixa a questão fora do ar, sem descartar.
 */
export async function secondOpinion(question: Question): Promise<Verdict> {
  const second = await blindSolve(question, SECOND_MODEL);
  const verdict = judgeBlind(second, question.correct_index, "segunda_opiniao", false);
  return verdict.ok ? pass : { ...verdict, hold: true };
}

/** Questão nova, escrita a partir do trecho das fontes. Erro claro descarta; dúvida segura. */
export async function checkNewQuestion(draft: Draft, sourceText: string, risk: "normal" | "alto"): Promise<Verdict> {
  const blind = judgeBlind(await blindSolve(draft), draft.correct_index, "resolucao_cega", true);
  if (!blind.ok) return blind;

  const check = await factCheck(draft, sourceText);
  if (!check) return hold("checagem", "Sem resposta do verificador.");
  if (!check.key_is_correct) return discard("checagem", "O verificador discorda do gabarito.");
  if (check.dangerous_content) return discard("checagem", check.dangerous_content);
  const unsupported = check.verdicts.filter((v) => !v.supported);
  if (unsupported.length) return discard("checagem", unsupported.map((v) => `${v.claim}: ${v.note}`).join(" | "));

  return risk === "alto" ? secondOpinion(draft) : pass;
}

/**
 * Questão sem o texto das fontes à mão: o verificador usa o que sabe das diretrizes.
 * - "existing" (lote já escrito): nada é descartado; o que levanta dúvida fica fora do ar para você olhar.
 * - "generated" (questão nova do gerador diário): erro claro descarta, porque gerar outra é barato; dúvida segura.
 */
export async function checkWithoutSources(question: Draft, risk: "normal" | "alto", mode: "existing" | "generated"): Promise<Verdict> {
  const strict = mode === "generated";
  const fail = strict ? discard : hold;
  const blind = judgeBlind(await blindSolve(question), question.correct_index, "resolucao_cega", strict);
  if (!blind.ok) return blind;

  const review = await safetyReview(question);
  if (!review) return hold("checagem", "Sem resposta do verificador.");
  if (!review.key_is_correct) return fail("checagem", "O verificador discorda do gabarito.");
  if (review.dangerous_content) return fail("checagem", review.dangerous_content);
  if (review.problems.length) return hold("checagem", review.problems.join(" | "));

  return risk === "alto" ? secondOpinion(question) : pass;
}

export const checkExistingQuestion = (question: Draft, risk: "normal" | "alto") => checkWithoutSources(question, risk, "existing");

/**
 * Questão nova escrita a partir de trechos do material privado (gerador diário).
 * - Erro claro (gabarito, conteúdo perigoso, resolução às cegas) descarta.
 * - O que o material não cobre passa por uma revisão de conhecimento: só segura se o verificador achar problema.
 */
export async function checkGrounded(draft: Draft, materialText: string, risk: "normal" | "alto"): Promise<Verdict> {
  const blind = judgeBlind(await blindSolve(draft), draft.correct_index, "resolucao_cega", true);
  if (!blind.ok) return blind;

  const check = await factCheck(draft, materialText);
  if (!check) return hold("checagem", "Sem resposta do verificador.");
  if (!check.key_is_correct) return discard("checagem", "O verificador discorda do gabarito.");
  if (check.dangerous_content) return discard("checagem", check.dangerous_content);
  if (check.verdicts.some((v) => !v.supported)) {
    const review = await safetyReview(draft);
    if (!review) return hold("checagem", "Sem resposta do verificador.");
    if (!review.key_is_correct) return discard("checagem", "O verificador discorda do gabarito.");
    if (review.dangerous_content) return discard("checagem", review.dangerous_content);
    if (review.problems.length) return hold("checagem", review.problems.join(" | "));
  }

  return risk === "alto" ? secondOpinion(draft) : pass;
}
