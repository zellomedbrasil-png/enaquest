import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createQuestions, createUser, db, makePremium } from "./helpers";
import { submitAnswer } from "@/lib/server/answers";
import { getReveal } from "@/lib/server/questions";
import { getRevealForAnswered, getStudyState, rateQuestion, setQuestionMark } from "@/lib/server/study";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const theory = {
  title: "Tema de teste",
  intro: "Introdução de teste com tamanho suficiente para passar.",
  sections: [{ heading: "Seção de teste", items: ["Item de teste"] }],
};
const summary = {
  title: "Resumo de teste",
  points: [
    { label: "Um", text: "Ponto um" },
    { label: "Dois", text: "Ponto dois" },
    { label: "Três", text: "Ponto três" },
  ],
};

describe("estudo da questão", () => {
  let user: Awaited<ReturnType<typeof createUser>>;

  beforeEach(async () => {
    user = await createUser();
    await makePremium(user.id);
  });

  it("entrega o material de estudo quando existe e null quando não existe", async () => {
    const [withExtras, without] = await createQuestions(2);
    await db().from("explanations").update({ key_why: "Porque o caso pede isso.", theory, summary }).eq("question_id", withExtras.id);
    const full = await getReveal(withExtras.id);
    expect(full.keyWhy).toBe("Porque o caso pede isso.");
    expect(full.theory?.title).toBe("Tema de teste");
    expect(full.summary?.points).toHaveLength(3);
    const bare = await getReveal(without.id);
    expect(bare).toMatchObject({ keyWhy: null, theory: null, summary: null });
  });

  it("ignora material fora do formato em vez de quebrar a tela", async () => {
    const [q] = await createQuestions(1);
    await db().from("explanations").update({ theory: { title: "x" }, summary: "texto solto" }).eq("question_id", q.id);
    const reveal = await getReveal(q.id);
    expect(reveal.theory).toBeNull();
    expect(reveal.summary).toBeNull();
  });

  it("só mostra o comentário de rever para quem já respondeu", async () => {
    const [q] = await createQuestions(1);
    await expect(getRevealForAnswered(user.id, q.id)).rejects.toThrow();
    await submitAnswer(user.id, { questionId: q.id, mode: "training", context: randomUUID(), selected: q.correct });
    const reveal = await getRevealForAnswered(user.id, q.id);
    expect(reveal.correctIndex).toBe(q.correct);
  });

  it("guarda, troca e apaga a avaliação da questão", async () => {
    const [q] = await createQuestions(1);
    await rateQuestion(user.id, q.id, 1);
    expect((await getStudyState(user.id, [q.id])).votes).toEqual({ [q.id]: 1 });
    await rateQuestion(user.id, q.id, -1);
    expect((await getStudyState(user.id, [q.id])).votes).toEqual({ [q.id]: -1 });
    await rateQuestion(user.id, q.id, 0);
    expect((await getStudyState(user.id, [q.id])).votes).toEqual({});
  });

  it("marcar para rever põe a questão na Revisão, mesmo sem ter errado", async () => {
    const [q] = await createQuestions(1);
    await setQuestionMark(user.id, q.id, true);
    expect((await getStudyState(user.id, [q.id])).marked).toEqual([q.id]);
    const { data: card } = await db().from("srs_cards").select("due").eq("user_id", user.id).eq("question_id", q.id).single();
    expect(new Date(card.due).getTime()).toBeLessThan(Date.now() + 2 * 86_400_000);
    await setQuestionMark(user.id, q.id, false);
    expect((await getStudyState(user.id, [q.id])).marked).toEqual([]);
  });

  it("não aceita avaliar questão que não está publicada", async () => {
    const [q] = await createQuestions(1, "clinica", { status: "in_review" });
    await expect(rateQuestion(user.id, q.id, 1)).rejects.toThrow();
    await expect(setQuestionMark(user.id, q.id, true)).rejects.toThrow();
  });

  it("um aluno não lê a avaliação nem as marcações de outro", async () => {
    const other = await createUser();
    const [q] = await createQuestions(1);
    await rateQuestion(other.id, q.id, 1);
    await setQuestionMark(other.id, q.id, true);
    const votes = await user.client.from("question_feedback").select("*");
    const marks = await user.client.from("question_marks").select("*");
    expect(votes.data ?? []).toEqual([]);
    expect(marks.data ?? []).toEqual([]);
    const own = await other.client.from("question_marks").select("question_id");
    expect(own.data).toEqual([{ question_id: q.id }]);
  });
});
