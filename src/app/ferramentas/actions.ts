"use server";

import { z } from "zod";
import { AppError } from "@/lib/server/session";
import { checkLevelAnswer, startLevelTest } from "@/lib/server/leveltest";

// Ações das ferramentas abertas: não exigem conta e não gravam nada da pessoa.
type Result<T> = { ok: true; data: T } | { ok: false; message: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, message: "Dados inválidos." };
    console.error(error);
    return { ok: false, message: "Algo deu errado. Tente de novo." };
  }
}

export async function startLevelTestAction() {
  return run(() => startLevelTest());
}

export async function checkLevelAnswerAction(questionId: string, selected: number) {
  return run(() => checkLevelAnswer(z.uuid().parse(questionId), z.number().int().min(0).max(4).parse(selected)));
}
