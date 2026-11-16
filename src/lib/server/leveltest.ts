import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { admin } from "@/lib/supabase/admin";
import { AppError, enforceRateLimit } from "./session";
import { getPublicQuestions, PLAYABLE_LICENSES, type PublicQuestion } from "./questions";
import { pickBalanced } from "./selection";

/** Teste de nível aberto, sem conta: nada é gravado, só o limite de uso por visitante. */
export const LEVEL_TEST_SIZE = 10;

/** Chave de limite por visitante. O IP vira hash para não guardar o endereço. */
async function visitorKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
  return createHash("sha256").update(`enaquest-teste:${ip}`).digest("hex").slice(0, 32);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function playable(query: any) {
  return query.eq("status", "published").in("license", PLAYABLE_LICENSES).eq("annulled", false).is("outdated_note", null);
}

export async function startLevelTest(): Promise<{ id: string; questions: PublicQuestion[] }> {
  await enforceRateLimit(`nivel:inicio:${await visitorKey()}`, 6, 3600);
  const db = admin();
  const [{ data: pool }, { data: areas }] = await Promise.all([
    playable(db.from("questions").select("id, area_id")),
    db.from("matrix_areas").select("id, exam_share"),
  ]);
  if (!pool?.length) throw new AppError("not_found", "O teste está indisponível no momento.");
  const id = randomUUID();
  const ids = pickBalanced(pool, areas ?? [], id, LEVEL_TEST_SIZE);
  return { id, questions: await getPublicQuestions(ids) };
}

export type LevelCheck = { correct: boolean; correctIndex: number; quick: string };

/** Corrige uma resposta do teste. Não grava a resposta nem mexe na estatística da questão. */
export async function checkLevelAnswer(questionId: string, selected: number): Promise<LevelCheck> {
  await enforceRateLimit(`nivel:resposta:${await visitorKey()}`, 80, 3600);
  const db = admin();
  const { data: question } = await playable(db.from("questions").select("id, options").eq("id", questionId)).maybeSingle();
  if (!question) throw new AppError("not_found", "Questão indisponível.");
  if (!Number.isInteger(selected) || selected < 0 || selected >= question.options.length) throw new AppError("invalid", "Alternativa inválida.");
  const [key, explanation] = await Promise.all([
    db.from("question_keys").select("correct_index").eq("question_id", questionId).single(),
    db.from("explanations").select("quick").eq("question_id", questionId).single(),
  ]);
  if (key.error || key.data.correct_index === null) throw new AppError("not_found", "Questão indisponível.");
  return { correct: key.data.correct_index === selected, correctIndex: key.data.correct_index, quick: explanation.data?.quick ?? "" };
}
