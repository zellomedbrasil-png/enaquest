import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { clearDaily, createQuestions, createUser, db, makePremium } from "./helpers";
import { setErrorReason, submitAnswer } from "@/lib/server/answers";
import { getDailyIds, getDailyState } from "@/lib/server/daily";
import { getDueReviews, getQuestionPage, startTraining } from "@/lib/server/study";
import { getPublicQuestions } from "@/lib/server/questions";
import { todayBR } from "@/lib/game/streak";
import * as community from "@/lib/server/community";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const context = () => randomUUID();

describe("correção de questões", () => {
  let user: Awaited<ReturnType<typeof createUser>>;

  beforeEach(async () => {
    user = await createUser();
    await makePremium(user.id);
  });

  it("nunca entrega o gabarito na questão pública", async () => {
    const [q] = await createQuestions(1);
    const [publicQuestion] = await getPublicQuestions([q.id]);
    const text = JSON.stringify(publicQuestion);
    expect(publicQuestion).not.toHaveProperty("correct_index");
    expect(publicQuestion).not.toHaveProperty("correctIndex");
    expect(text).not.toContain("Resumo de teste");
    expect(text).not.toContain("Raciocínio de teste");
  });

  it("corrige, pontua e atualiza o rating", async () => {
    const [q] = await createQuestions(1);
    const result = await submitAnswer(user.id, { questionId: q.id, mode: "training", context: context(), selected: q.correct, confidence: "certeza" });
    expect(result.correct).toBe(true);
    expect(result.reveal.correctIndex).toBe(q.correct);
    expect(result.xpGained).toBe(12);
    expect(result.ratingDelta).toBeGreaterThan(0);
    const { data } = await db().from("rating_state").select("rating, games, xp_total").eq("user_id", user.id).single();
    expect(Number(data.rating)).toBe(900 + result.ratingDelta);
    expect(data.games).toBe(1);
    // 12 da questão + 50 da conquista de primeira questão.
    expect(data.xp_total).toBe(62);
  });

  it("clique duplo não pontua duas vezes", async () => {
    const [q] = await createQuestions(1);
    const ctx = context();
    const input = { questionId: q.id, mode: "training" as const, context: ctx, selected: q.correct };
    const results = await Promise.all([submitAnswer(user.id, input), submitAnswer(user.id, input), submitAnswer(user.id, input)]);
    const { data } = await db().from("rating_state").select("games, xp_total").eq("user_id", user.id).single();
    const { count } = await db().from("answers").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    expect(count).toBe(1);
    expect(data.games).toBe(1);
    expect(data.xp_total).toBe(62);
    const ledger = await db().from("xp_ledger").select("kind").eq("user_id", user.id);
    expect(ledger.data.map((row: { kind: string }) => row.kind).sort()).toEqual(["achievement", "attempt", "correct"]);
    expect(results.every((r) => r.correct)).toBe(true);
  });

  it("refazer a mesma questão no treino não rende XP nem rating", async () => {
    const [q] = await createQuestions(1);
    await submitAnswer(user.id, { questionId: q.id, mode: "training", context: context(), selected: q.correct });
    const again = await submitAnswer(user.id, { questionId: q.id, mode: "training", context: context(), selected: q.correct });
    expect(again.xpGained).toBe(0);
    expect(again.ratingDelta).toBe(0);
  });

  it("não aceita alternativa inexistente", async () => {
    const [q] = await createQuestions(1);
    await expect(submitAnswer(user.id, { questionId: q.id, mode: "training", context: context(), selected: 7 })).rejects.toThrow("Alternativa inválida");
  });

  it("não aceita questão em quarentena ou rascunho", async () => {
    const [q] = await createQuestions(1, "clinica", { status: "quarantined" });
    await expect(submitAnswer(user.id, { questionId: q.id, mode: "training", context: context(), selected: 0 })).rejects.toThrow("indisponível");
  });

  it("plano grátis não usa treino nem revisão", async () => {
    const free = await createUser();
    const [q] = await createQuestions(1);
    await expect(submitAnswer(free.id, { questionId: q.id, mode: "training", context: context(), selected: 0 })).rejects.toMatchObject({ code: "premium_required" });
    await expect(startTraining(free.id, { filter: "todas", size: 5 })).rejects.toMatchObject({ code: "premium_required" });
    await expect(getDueReviews(free.id)).rejects.toMatchObject({ code: "premium_required" });
  });

  it("acesso vencido volta a bloquear", async () => {
    await makePremium(user.id, new Date(Date.now() - 1000));
    const [q] = await createQuestions(1);
    await expect(submitAnswer(user.id, { questionId: q.id, mode: "training", context: context(), selected: 0 })).rejects.toMatchObject({ code: "premium_required" });
  });

  it("erro entra na revisão, e o acerto com certeza não", async () => {
    const [wrong, right] = await createQuestions(2);
    await submitAnswer(user.id, { questionId: wrong.id, mode: "training", context: context(), selected: (wrong.correct + 1) % 4, confidence: "certeza" });
    await submitAnswer(user.id, { questionId: right.id, mode: "training", context: context(), selected: right.correct, confidence: "certeza" });
    const { data } = await db().from("srs_cards").select("question_id").eq("user_id", user.id);
    expect(data.map((c: { question_id: string }) => c.question_id)).toEqual([wrong.id]);
  });

  it("diagnosticar o erro grava o motivo e rende XP uma vez só", async () => {
    const [q] = await createQuestions(1);
    const result = await submitAnswer(user.id, { questionId: q.id, mode: "training", context: context(), selected: (q.correct + 1) % 4 });
    await setErrorReason(user.id, result.answerId!, "leitura");
    await setErrorReason(user.id, result.answerId!, "pressa");
    const answer = await db().from("answers").select("error_reason").eq("id", result.answerId).single();
    const xp = await db().from("xp_ledger").select("id").eq("user_id", user.id).eq("kind", "diagnosed");
    expect(answer.data.error_reason).toBe("pressa");
    expect(xp.data).toHaveLength(1);
  });

  it("não deixa marcar motivo em resposta de outra pessoa", async () => {
    const other = await createUser();
    const [q] = await createQuestions(1);
    const result = await submitAnswer(user.id, { questionId: q.id, mode: "training", context: context(), selected: (q.correct + 1) % 4 });
    await expect(setErrorReason(other.id, result.answerId!, "leitura")).rejects.toThrow();
  });

  it("só mostra comentário na página da questão depois de responder", async () => {
    const [q] = await createQuestions(1);
    const before = await getQuestionPage(user.id, q.slug);
    expect(before?.reveal).toBeNull();
    await submitAnswer(user.id, { questionId: q.id, mode: "training", context: context(), selected: 0 });
    const after = await getQuestionPage(user.id, q.slug);
    expect(after?.reveal?.correctIndex).toBe(q.correct);
  });

  it("libera conquistas", async () => {
    const [q] = await createQuestions(1);
    const result = await submitAnswer(user.id, { questionId: q.id, mode: "training", context: context(), selected: 0 });
    expect(result.newAchievements).toContain("primeiro_plantao");
  });
});

describe("Plantão do Dia", () => {
  it("é o mesmo para todos, grátis, e fecha com bônus", async () => {
    const day = todayBR();
    await clearDaily(day);
    const made = await createQuestions(10);
    await db().from("daily_challenges").insert({ day, question_ids: made.map((q) => q.id) });
    const [a, b] = await Promise.all([createUser(), createUser()]);
    expect(await getDailyIds(day)).toEqual(made.map((q) => q.id));

    let last;
    for (const q of made) {
      last = await submitAnswer(a.id, { questionId: q.id, mode: "daily", context: day, selected: q.correct });
    }
    expect(last?.dailyFinished).toEqual({ correct: 10, total: 10 });
    const state = await getDailyState(a.id, day);
    expect(state.done).toBe(true);
    const { data } = await db().from("xp_ledger").select("kind").eq("user_id", a.id).in("kind", ["daily_complete", "daily_perfect"]);
    expect(data).toHaveLength(2);
    expect((await getDailyState(b.id, day)).done).toBe(false);
    await clearDaily(day);
  });

  it("recusa questão fora do plantão de hoje", async () => {
    const day = todayBR();
    await clearDaily(day);
    const [inside, outside] = await createQuestions(2);
    await db().from("daily_challenges").insert({ day, question_ids: [inside.id] });
    const free = await createUser();
    await expect(submitAnswer(free.id, { questionId: outside.id, mode: "daily", context: day, selected: 0 })).rejects.toMatchObject({ code: "closed" });
    await expect(submitAnswer(free.id, { questionId: inside.id, mode: "daily", context: "2020-01-01", selected: 0 })).rejects.toMatchObject({ code: "closed" });
    await clearDaily(day);
  });
});

describe("comunidade e quarentena", () => {
  it("só comenta quem respondeu, e voto rende XP ao autor", async () => {
    const [author, reader] = await Promise.all([createUser(), createUser()]);
    await Promise.all([makePremium(author.id), makePremium(reader.id)]);
    const [q] = await createQuestions(1);
    await expect(community.addComment(author.id, q.id, "Comentário antes de responder")).rejects.toThrow("Responda");

    await submitAnswer(author.id, { questionId: q.id, mode: "training", context: context(), selected: 0 });
    await submitAnswer(reader.id, { questionId: q.id, mode: "training", context: context(), selected: 0 });
    await community.addComment(author.id, q.id, "Lembre do critério principal do caso.");
    const [comment] = await community.listComments(reader.id, q.id);

    await expect(community.voteComment(author.id, comment.id)).rejects.toThrow("próprio");
    expect(await community.voteComment(reader.id, comment.id)).toBe(1);
    expect(await community.voteComment(reader.id, comment.id)).toBe(1);
    const { data } = await db().from("xp_ledger").select("amount").eq("user_id", author.id).eq("kind", "comment_vote");
    expect(data).toHaveLength(1);
  });

  it("5 denúncias distintas tiram a questão do ar, e a mesma pessoa conta uma vez", async () => {
    const [q] = await createQuestions(1);
    const users = await Promise.all(Array.from({ length: 5 }, () => createUser()));
    await Promise.all(users.map((u) => makePremium(u.id)));
    for (const u of users) await submitAnswer(u.id, { questionId: q.id, mode: "training", context: context(), selected: 0 });

    for (let i = 0; i < 3; i++) await community.reportQuestion(users[0].id, q.id, "gabarito", "Parece errado");
    for (const u of users.slice(1, 4)) await community.reportQuestion(u.id, q.id, "gabarito", null);
    let status = await db().from("questions").select("status").eq("id", q.id).single();
    expect(status.data.status).toBe("published");

    await community.reportQuestion(users[4].id, q.id, "gabarito", null);
    status = await db().from("questions").select("status").eq("id", q.id).single();
    expect(status.data.status).toBe("quarantined");
  });

  it("discriminação negativa tira a questão do ar", async () => {
    const [q] = await createQuestions(1);
    await db().from("item_stats").insert({ question_id: q.id, n: 60, upper_n: 30, upper_correct: 6, lower_n: 30, lower_correct: 24 });
    await db().rpc("check_quarantine", { p_question: q.id });
    const { data } = await db().from("questions").select("status").eq("id", q.id).single();
    expect(data.status).toBe("quarantined");
  });
});
