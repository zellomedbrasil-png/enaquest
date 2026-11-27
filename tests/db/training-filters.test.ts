import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createQuestions, createUser, db, makePremium } from "./helpers";
import { submitAnswer } from "@/lib/server/answers";
import { countTraining, startTraining, trainingCatalog } from "@/lib/server/study";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

describe("filtros do Treino no banco", () => {
  let user: Awaited<ReturnType<typeof createUser>>;

  beforeEach(async () => {
    user = await createUser();
  });

  it("conta questões para o plano grátis, mas só a assinatura começa a rodada", async () => {
    await createQuestions(3, "mental");
    expect(await countTraining(user.id, { areaId: "mental", filter: "todas", size: 10 })).toBeGreaterThanOrEqual(3);
    await expect(startTraining(user.id, { areaId: "mental", filter: "todas", size: 5 })).rejects.toMatchObject({ code: "premium_required" });
  });

  it("filtra por tema e por dificuldade", async () => {
    await makePremium(user.id);
    const theme = `Tema ${randomUUID()}`;
    const [easy] = await createQuestions(1, "coletiva");
    const [hard] = await createQuestions(1, "coletiva");
    await db().from("questions").update({ theme, difficulty: "facil" }).eq("id", easy.id);
    await db().from("questions").update({ theme, difficulty: "dificil" }).eq("id", hard.id);

    expect(await countTraining(user.id, { areaId: "coletiva", theme, filter: "todas", size: 10 })).toBe(2);
    const round = await startTraining(user.id, { areaId: "coletiva", theme, difficulties: ["dificil"], filter: "todas", size: 5 });
    expect(round.questions.map((q) => q.id)).toEqual([hard.id]);
  });

  it("acertei sem certeza traz o acerto no chute", async () => {
    await makePremium(user.id);
    const theme = `Tema ${randomUUID()}`;
    const [q] = await createQuestions(1, "mfc");
    await db().from("questions").update({ theme }).eq("id", q.id);
    await submitAnswer(user.id, { questionId: q.id, mode: "training", context: randomUUID(), selected: q.correct, confidence: "chute" });
    const round = await startTraining(user.id, { areaId: "mfc", theme, filter: "inseguras", size: 5 });
    expect(round.questions.map((x) => x.id)).toEqual([q.id]);
  });

  it("o catálogo lista os temas da área", async () => {
    const theme = `Tema ${randomUUID()}`;
    const [q] = await createQuestions(1, "go");
    await db().from("questions").update({ theme }).eq("id", q.id);
    const catalog = await trainingCatalog();
    expect(catalog.themes.go.some((t) => t.theme === theme)).toBe(true);
  });
});
