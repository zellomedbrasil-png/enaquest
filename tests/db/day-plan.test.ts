import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuestions, createUser, db, makePremium } from "./helpers";
import { submitAnswer } from "@/lib/server/answers";
import { dayContext, getDayView, saveStudyGoals, startDayBlock } from "@/lib/server/day-plan";
import { todayBR } from "@/lib/game/streak";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

describe("Seu dia", () => {
  let user: Awaited<ReturnType<typeof createUser>>;

  beforeEach(async () => {
    user = await createUser();
  });

  it("perfil novo começa com 60 minutos e sem metas definidas", async () => {
    const view = await getDayView(user.id);
    expect(view.goals).toMatchObject({ minutes: 60, targetExam: "enamed", examDate: null, set: false });
    expect(view.plan.blocks[0].kind).toBe("plantao");
  });

  it("salva as metas e o plano passa a usá-las", async () => {
    await saveStudyGoals(user.id, { minutes: 180, targetExam: "enare", examDate: null });
    const view = await getDayView(user.id);
    expect(view.goals).toMatchObject({ minutes: 180, targetExam: "enare", set: true });
    expect(view.plan.minutes).toBe(180);
  });

  it("recusa data de prova no passado ou inválida", async () => {
    await expect(saveStudyGoals(user.id, { minutes: 60, targetExam: "enamed", examDate: "2020-01-01" })).rejects.toMatchObject({ code: "invalid" });
    await expect(saveStudyGoals(user.id, { minutes: 60, targetExam: "enamed", examDate: "2030-02-31" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("blocos além do Plantão exigem assinatura", async () => {
    await expect(startDayBlock(user.id, "novas")).rejects.toMatchObject({ code: "premium_required" });
  });

  it("o bloco de questões novas traz só questões nunca respondidas e conta o progresso", async () => {
    await makePremium(user.id);
    await createQuestions(30, "clinica");
    await saveStudyGoals(user.id, { minutes: 300, targetExam: "enamed", examDate: null });

    const round = await startDayBlock(user.id, "novas");
    expect(round.questions.length).toBeGreaterThan(0);
    expect(round.context).toBe(dayContext(todayBR(), "novas"));

    const { data: answered } = await db().from("answers").select("question_id").eq("user_id", user.id);
    const seen = new Set((answered ?? []).map((a: { question_id: string }) => a.question_id));
    expect(round.questions.every((q) => !seen.has(q.id))).toBe(true);

    const first = round.questions[0];
    await submitAnswer(user.id, { questionId: first.id, mode: "training", context: round.context, selected: 0 });
    const view = await getDayView(user.id);
    expect(view.plan.blocks.find((b) => b.kind === "novas")?.done).toBe(1);

    const next = await startDayBlock(user.id, "novas");
    expect(next.questions.some((q) => q.id === first.id)).toBe(false);
  });

  it("erros para refazer trazem o que a pessoa errou", async () => {
    await makePremium(user.id);
    const [q] = await createQuestions(1, "pediatria");
    await submitAnswer(user.id, { questionId: q.id, mode: "training", context: "antes", selected: (q.correct + 1) % 4, confidence: "chute" });
    // A carta de revisão ainda não venceu: o erro fica no bloco de erros, não na revisão.
    await db().from("srs_cards").update({ due: new Date(Date.now() + 5 * 86_400_000).toISOString() }).eq("user_id", user.id).eq("question_id", q.id);
    await saveStudyGoals(user.id, { minutes: 300, targetExam: "enamed", examDate: null });
    const round = await startDayBlock(user.id, "erros");
    expect(round.questions.map((x) => x.id)).toContain(q.id);
  });
});
