import { beforeAll, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { createQuestions, createUser, db, makePremium } from "./helpers";
import { finishSimulado, getSimuladoResult, saveSimuladoProgress, startOrResumeSimulado } from "@/lib/server/simulados";
import { approveLot, decideSample, getLotReview, getModerationQueue, rejectLot } from "@/lib/server/editorial";
import { createGroup, currentWeek, getLeagueView, joinGroup, rolloverPreviousWeek } from "@/lib/server/leagues";
import { handleStripeEvent, withdrawSubscription } from "@/lib/billing/subscriptions";
import { hasPremiumAccess } from "@/lib/billing/access";
import { getEvolution } from "@/lib/server/progress";
import { submitAnswer } from "@/lib/server/answers";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

async function createSimulado(ids: string[], overrides: Record<string, unknown> = {}) {
  const { data, error } = await db()
    .from("simulados")
    .insert({
      title: `Simulado de teste ${randomUUID()}`,
      opens_at: new Date(Date.now() - 3_600_000).toISOString(),
      closes_at: new Date(Date.now() + 86_400_000).toISOString(),
      duration_minutes: 300,
      question_ids: ids,
      published: true,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

describe("simulado de 100 questões", () => {
  let questions: { id: string; correct: number }[];
  let simuladoId: string;
  let user: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    questions = await createQuestions(100);
    simuladoId = await createSimulado(questions.map((q) => q.id));
    user = await createUser();
    await makePremium(user.id);
  }, 120000);

  it("não entrega gabarito ao começar, e dá 5 horas de prazo", async () => {
    const attempt = await startOrResumeSimulado(user.id, simuladoId);
    expect(attempt.questions).toHaveLength(100);
    const text = JSON.stringify(attempt);
    expect(text).not.toContain("correct");
    expect(text).not.toContain("Resumo de teste");
    const hours = (new Date(attempt.deadline).getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(4.99);
    expect(hours).toBeLessThanOrEqual(5);
  });

  it("retoma do mesmo ponto depois de fechar o navegador, sem renovar o prazo", async () => {
    const first = await startOrResumeSimulado(user.id, simuladoId);
    const answers = Object.fromEntries(questions.slice(0, 60).map((q) => [q.id, q.correct]));
    await saveSimuladoProgress(user.id, first.attemptId, { answers, flags: [questions[0].id] });
    const again = await startOrResumeSimulado(user.id, simuladoId);
    expect(again.attemptId).toBe(first.attemptId);
    expect(again.deadline).toBe(first.deadline);
    expect(Object.keys(again.answers)).toHaveLength(60);
    expect(again.flags).toEqual([questions[0].id]);
  });

  it("calcula o resultado certo, sem mexer no rating, e manda erros para a revisão", async () => {
    const first = await startOrResumeSimulado(user.id, simuladoId);
    const answers: Record<string, number> = {};
    questions.slice(0, 60).forEach((q) => (answers[q.id] = q.correct));
    questions.slice(60, 80).forEach((q) => (answers[q.id] = (q.correct + 1) % 4));
    await saveSimuladoProgress(user.id, first.attemptId, { answers, flags: [] });
    const before = await db().from("rating_state").select("rating").eq("user_id", user.id).single();

    await finishSimulado(user.id, first.attemptId);
    await finishSimulado(user.id, first.attemptId); // entregar duas vezes não muda nada

    const result = await getSimuladoResult(user.id, simuladoId);
    expect(result?.correct).toBe(60);
    expect(result?.total).toBe(100);
    expect(result?.answered).toBe(80);
    expect(result?.byArea.find((a) => a.id === "clinica")).toMatchObject({ correct: 60, total: 100 });

    const after = await db().from("rating_state").select("rating").eq("user_id", user.id).single();
    expect(after.data.rating).toBe(before.data.rating);
    const cards = await db().from("srs_cards").select("question_id").eq("user_id", user.id);
    expect(cards.data).toHaveLength(20);
    const xp = await db().from("xp_ledger").select("amount").eq("user_id", user.id).eq("kind", "simulado");
    expect(xp.data).toEqual([{ amount: 400 }]);
  });

  it("não aceita alterar a prova depois de entregue", async () => {
    const { attemptId } = await startOrResumeSimulado(user.id, simuladoId);
    await expect(saveSimuladoProgress(user.id, attemptId, { answers: {}, flags: [] })).rejects.toMatchObject({ code: "closed" });
  });

  it("encerra sozinho quando o tempo acabou com a página fechada", async () => {
    const late = await createUser();
    await makePremium(late.id);
    const small = await createQuestions(3);
    const id = await createSimulado(small.map((q) => q.id));
    const attempt = await startOrResumeSimulado(late.id, id);
    await saveSimuladoProgress(late.id, attempt.attemptId, { answers: { [small[0].id]: small[0].correct }, flags: [] });
    await db().from("simulado_attempts").update({ deadline: new Date(Date.now() - 60_000).toISOString() }).eq("id", attempt.attemptId);
    const resumed = await startOrResumeSimulado(late.id, id);
    expect(resumed.finished).toBe(true);
    expect((await getSimuladoResult(late.id, id))?.correct).toBe(1);
  });

  it("não deixa uma pessoa mexer na prova de outra", async () => {
    const intruder = await createUser();
    const { attemptId } = await startOrResumeSimulado(user.id, simuladoId);
    await expect(saveSimuladoProgress(intruder.id, attemptId, { answers: {}, flags: [] })).rejects.toThrow();
    await expect(finishSimulado(intruder.id, attemptId)).rejects.toThrow();
  });

  it("fora da janela não começa, e plano grátis não entra", async () => {
    const closedId = await createSimulado([questions[0].id], { closes_at: new Date(Date.now() - 1000).toISOString() });
    await expect(startOrResumeSimulado(user.id, closedId)).rejects.toMatchObject({ code: "closed" });
    const free = await createUser();
    await expect(startOrResumeSimulado(free.id, simuladoId)).rejects.toMatchObject({ code: "premium_required" });
  });
});

describe("aprovação de lote", () => {
  async function createLot(count: number) {
    const id = `lote-teste-${randomUUID()}`;
    await db().from("review_lots").insert({ id });
    const questions = await createQuestions(count, "clinica", { status: "in_review", lot_id: id });
    return { id, questions };
  }

  it("mantém questões do lote fora do ar até a aprovação", async () => {
    const { questions } = await createLot(2);
    const reader = await createUser();
    await makePremium(reader.id);
    await expect(submitAnswer(reader.id, { questionId: questions[0].id, mode: "training", context: "c", selected: 0 })).rejects.toThrow("indisponível");
  });

  it("sorteia até 59 e mantém a mesma amostra", async () => {
    const { id } = await createLot(70);
    const first = await getLotReview(id);
    const second = await getLotReview(id);
    expect(first.items).toHaveLength(59);
    expect(first.total).toBe(70);
    expect(second.items.map((i: { question: { id: string } }) => i.question.id).sort()).toEqual(first.items.map((i: { question: { id: string } }) => i.question.id).sort());
  }, 60000);

  it("não aprova com amostra pendente nem com erro crítico", async () => {
    const editor = await createUser();
    const { id, questions } = await createLot(3);
    await getLotReview(id);
    await expect(approveLot(editor.id, id)).rejects.toThrow("sem decisão");
    for (const q of questions) await decideSample(editor.id, { lotId: id, questionId: q.id, decision: "ok" });
    await decideSample(editor.id, { lotId: id, questionId: questions[0].id, decision: "critical", notes: "Gabarito errado" });
    const lot = await db().from("review_lots").select("status, held_reason").eq("id", id).single();
    expect(lot.data).toEqual({ status: "held", held_reason: "Gabarito errado" });
    await expect(approveLot(editor.id, id)).rejects.toThrow("erro crítico");
    const stillDraft = await db().from("questions").select("status").eq("lot_id", id);
    expect(stillDraft.data.every((q: { status: string }) => q.status === "in_review")).toBe(true);
  });

  it("selos são honestos: só leva 'revisada' quem foi lida e aprovada", async () => {
    const editor = await createUser();
    const { id, questions } = await createLot(70);
    const review = await getLotReview(id);
    const sampled: string[] = review.items.map((i: { question: { id: string } }) => i.question.id);
    for (const [index, questionId] of sampled.entries()) {
      await decideSample(editor.id, { lotId: id, questionId, decision: index === 0 ? "minor" : "ok", notes: index === 0 ? "Ajustar texto" : null });
    }
    await approveLot(editor.id, id);

    const { data } = await db().from("questions").select("id, status, verification").eq("lot_id", id);
    const byId = new Map<string, { status: string; verification: string }>(data.map((q: { id: string; status: string; verification: string }) => [q.id, q]));
    expect(byId.get(sampled[0])).toEqual(expect.objectContaining({ status: "in_review" }));
    expect(byId.get(sampled[1])).toEqual(expect.objectContaining({ status: "published", verification: "medico_revisado" }));
    const notSampled = questions.find((q) => !sampled.includes(q.id))!;
    expect(byId.get(notSampled.id)).toEqual(expect.objectContaining({ status: "published", verification: "lote_amostrado" }));
  }, 120000);

  it("rejeitar um lote retira as questões", async () => {
    const editor = await createUser();
    const { id } = await createLot(2);
    await rejectLot(editor.id, id, "Qualidade insuficiente");
    const { data } = await db().from("questions").select("status").eq("lot_id", id);
    expect(data.every((q: { status: string }) => q.status === "retired")).toBe(true);
  });

  it("a fila de moderação carrega", async () => {
    const queue = await getModerationQueue();
    expect(queue).toHaveProperty("appeals");
    expect(queue).toHaveProperty("comments");
  });
});

describe("ligas e turmas", () => {
  it("coloca o usuário em um grupo ao ganhar XP, e o ranking usa apelido", async () => {
    const user = await createUser();
    const [q] = await createQuestions(1);
    await makePremium(user.id);
    await submitAnswer(user.id, { questionId: q.id, mode: "training", context: randomUUID(), selected: q.correct });
    const view = await getLeagueView(user.id);
    expect(view.member).toBe(true);
    expect(view.table.find((r) => r.me)?.xp).toBeGreaterThan(0);
    expect(JSON.stringify(view)).not.toContain(user.email);
  });

  it("sobe os 5 primeiros e desce os 5 últimos na virada", async () => {
    const previous = new Date(`${await currentWeek()}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 7);
    const week = previous.toISOString().slice(0, 10);
    const group = Math.floor(Math.random() * 1e6) + 1000;
    const users = await Promise.all(Array.from({ length: 12 }, () => createUser()));
    await db().from("profiles").update({ league_tier: 2 }).in("id", users.map((u) => u.id));
    await db().from("league_members").insert(users.map((u, i) => ({ week_start: week, user_id: u.id, tier: 2, group_no: group, xp: 1000 - i * 10 })));

    await rolloverPreviousWeek();

    const { data } = await db().from("profiles").select("id, league_tier").in("id", users.map((u) => u.id));
    const tier = (i: number) => data.find((p: { id: string }) => p.id === users[i].id).league_tier;
    expect(tier(0)).toBe(3);
    expect(tier(4)).toBe(3);
    expect(tier(5)).toBe(2);
    expect(tier(6)).toBe(2);
    expect(tier(7)).toBe(1);
    expect(tier(11)).toBe(1);

    // Rodar de novo não promove ninguém duas vezes.
    await rolloverPreviousWeek();
    const again = await db().from("profiles").select("league_tier").eq("id", users[0].id).single();
    expect(again.data.league_tier).toBe(3);
  }, 60000);

  it("Liga das Faculdades só mostra instituição com 5 alunos ativos", async () => {
    const { data: school } = await db().from("schools").insert({ name: `Faculdade ${randomUUID()}`, uf: "CE" }).select("id, name").single();
    const week = await currentWeek();
    const users = await Promise.all(Array.from({ length: 4 }, () => createUser()));
    await db().from("profiles").update({ school_id: school.id }).in("id", users.map((u) => u.id));
    for (const u of users) await db().rpc("award_xp", { p_user: u.id, p_amount: 100, p_kind: "teste", p_ref: randomUUID() });
    const names = async () => ((await db().rpc("school_ranking", { p_week: week })).data as { school_name: string }[]).map((r) => r.school_name);
    expect(await names()).not.toContain(school.name);

    const fifth = await createUser();
    await db().from("profiles").update({ school_id: school.id }).eq("id", fifth.id);
    await db().rpc("award_xp", { p_user: fifth.id, p_amount: 100, p_kind: "teste", p_ref: randomUUID() });
    expect(await names()).toContain(school.name);
  }, 60000);

  it("turma funciona por código", async () => {
    const [owner, friend] = await Promise.all([createUser(), createUser()]);
    const code = await createGroup(owner.id, "Internato 2027");
    await joinGroup(friend.id, code.toLowerCase());
    const view = await getLeagueView(friend.id);
    expect(view.groups[0].table).toHaveLength(2);
    await expect(joinGroup(friend.id, "NAOEXISTE")).rejects.toThrow("não encontrado");
  });
});

describe("assinatura (eventos da Stripe)", () => {
  const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
  const sub = (id: string, customer: string, status: string, end = periodEnd) =>
    ({
      id,
      object: "subscription",
      customer,
      status,
      metadata: {},
      cancel_at_period_end: false,
      items: { data: [{ current_period_end: end, price: { id: "price_test" } }] },
    }) as unknown as Stripe.Subscription;
  const event = (type: string, object: unknown) => ({ id: `evt_${randomUUID()}`, type, data: { object } }) as unknown as Stripe.Event;

  function fakeStripe(subscription: Stripe.Subscription, paymentIntent = "pi_test") {
    return {
      subscriptions: { retrieve: vi.fn(async () => subscription), cancel: vi.fn(async () => subscription) },
      invoices: { retrieve: vi.fn(async () => ({ payments: { data: [{ payment: { payment_intent: paymentIntent } }] } })) },
      refunds: { create: vi.fn(async () => ({ id: "re_test" })) },
    } as unknown as Stripe;
  }

  async function subscriber() {
    const user = await createUser();
    const customer = `cus_${randomUUID()}`;
    await db().from("stripe_customers").insert({ user_id: user.id, stripe_customer_id: customer });
    return { user, customer, subscriptionId: `sub_${randomUUID()}` };
  }

  const entitlement = async (id: string) => (await db().from("entitlements").select("plan, access_until, payment_problem").eq("user_id", id).single()).data;

  it("libera o acesso quando a assinatura fica ativa", async () => {
    const { user, customer, subscriptionId } = await subscriber();
    const active = sub(subscriptionId, customer, "active");
    const outcome = await handleStripeEvent(event("checkout.session.completed", { subscription: subscriptionId }), fakeStripe(active));
    expect(outcome).toBe("processed");
    expect(hasPremiumAccess(await entitlement(user.id))).toBe(true);
  });

  it("evento repetido é ignorado", async () => {
    const { customer, subscriptionId } = await subscriber();
    const e = event("customer.subscription.updated", sub(subscriptionId, customer, "active"));
    expect(await handleStripeEvent(e)).toBe("processed");
    expect(await handleStripeEvent(e)).toBe("duplicate");
  });

  it("evento que falha pode ser processado de novo", async () => {
    const orphan = event("customer.subscription.updated", sub(`sub_${randomUUID()}`, `cus_${randomUUID()}`, "active"));
    await expect(handleStripeEvent(orphan)).rejects.toThrow("sem usuário");
    const { data } = await db().from("stripe_events").select("id").eq("id", orphan.id);
    expect(data).toHaveLength(0);
  });

  it("cobrança falha mantém o acesso com aviso, e depois bloqueia", async () => {
    const { user, customer, subscriptionId } = await subscriber();
    await handleStripeEvent(event("customer.subscription.updated", sub(subscriptionId, customer, "active")));
    await handleStripeEvent(event("customer.subscription.updated", sub(subscriptionId, customer, "past_due")));
    const pastDue = await entitlement(user.id);
    expect(pastDue.payment_problem).toBe(true);
    expect(hasPremiumAccess(pastDue)).toBe(true);
    await handleStripeEvent(event("customer.subscription.updated", sub(subscriptionId, customer, "unpaid")));
    expect(hasPremiumAccess(await entitlement(user.id))).toBe(false);
  });

  it("renovação paga estende o acesso e registra o pagamento", async () => {
    const { user, customer, subscriptionId } = await subscriber();
    const later = periodEnd + 30 * 86400;
    const renewed = sub(subscriptionId, customer, "active", later);
    await db().from("subscriptions").insert({ id: subscriptionId, user_id: user.id, status: "active" });
    const invoice = { id: `in_${randomUUID()}`, customer, amount_paid: 2900, amount_due: 2900, currency: "brl", parent: { subscription_details: { subscription: subscriptionId } } };
    await handleStripeEvent(event("invoice.paid", invoice), fakeStripe(renewed));
    const access = await entitlement(user.id);
    expect(new Date(access.access_until).getTime()).toBe(later * 1000);
    const payment = await db().from("payments").select("amount, status, charge_id").eq("id", invoice.id).single();
    expect(payment.data).toEqual({ amount: 2900, status: "paid", charge_id: "pi_test" });
    const row = await db().from("subscriptions").select("first_paid_at").eq("id", subscriptionId).single();
    expect(row.data.first_paid_at).not.toBeNull();
  });

  it("cancelamento mantém o acesso até o fim do período pago", async () => {
    const { user, customer, subscriptionId } = await subscriber();
    await handleStripeEvent(event("customer.subscription.deleted", sub(subscriptionId, customer, "canceled")));
    const access = await entitlement(user.id);
    expect(access.plan).toBe("free");
    expect(hasPremiumAccess(access)).toBe(true);
  });

  it("reembolso e contestação cortam o acesso", async () => {
    for (const [type, object] of [
      ["charge.refunded", { refunded: true, payment_intent: "PI" }],
      ["charge.dispute.created", { payment_intent: "PI" }],
    ] as const) {
      const { user, customer, subscriptionId } = await subscriber();
      await handleStripeEvent(event("customer.subscription.updated", sub(subscriptionId, customer, "active")));
      const pi = `pi_${randomUUID()}`;
      await db().from("payments").insert({ id: `in_${randomUUID()}`, user_id: user.id, charge_id: pi, amount: 2900, currency: "brl", status: "paid" });
      await handleStripeEvent(event(type, { ...object, payment_intent: pi }));
      expect(hasPremiumAccess(await entitlement(user.id)), type).toBe(false);
    }
  });

  it("direito de arrependimento: até 7 dias reembolsa e cancela; depois, não", async () => {
    const { user, subscriptionId } = await subscriber();
    const paid = new Date(Date.now() - 2 * 86_400_000).toISOString();
    await db().from("subscriptions").insert({ id: subscriptionId, user_id: user.id, status: "active", first_paid_at: paid });
    await db().from("payments").insert({ id: `in_${randomUUID()}`, user_id: user.id, charge_id: "pi_refund", amount: 2900, currency: "brl", status: "paid", paid_at: paid });
    await makePremium(user.id);
    const stripe = fakeStripe(sub(subscriptionId, "cus", "active"));
    await withdrawSubscription(user.id, stripe);
    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_refund" });
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith(subscriptionId);
    expect(hasPremiumAccess(await entitlement(user.id))).toBe(false);

    const late = await subscriber();
    await db().from("subscriptions").insert({ id: late.subscriptionId, user_id: late.user.id, status: "active", first_paid_at: new Date(Date.now() - 8 * 86_400_000).toISOString() });
    const lateStripe = fakeStripe(sub(late.subscriptionId, "cus", "active"));
    await expect(withdrawSubscription(late.user.id, lateStripe)).rejects.toMatchObject({ code: "closed" });
    expect(lateStripe.refunds.create).not.toHaveBeenCalled();
  });

  it("evento desconhecido não quebra", async () => {
    expect(await handleStripeEvent(event("customer.created", {}))).toBe("ignored");
  });
});

describe("Termômetro", () => {
  it("só aparece depois do mínimo, e não inventa chance sem calibração", async () => {
    const user = await createUser();
    await makePremium(user.id);
    const questions = await createQuestions(50);
    let evolution = await getEvolution(user.id);
    expect(evolution.overall.ready).toBe(false);
    await db().from("answers").insert(questions.map((q, i) => ({ user_id: user.id, question_id: q.id, mode: "training", context: "x", selected: q.correct, is_correct: i % 3 !== 0 })));
    evolution = await getEvolution(user.id);
    expect(evolution.overall.ready).toBe(true);
    expect(evolution.overall.chanceProficient).toBeNull();
    expect(evolution.overall.low!).toBeLessThan(evolution.overall.high!);
  }, 60000);
});
