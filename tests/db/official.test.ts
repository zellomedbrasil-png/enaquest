import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { clearDaily, createQuestions, createUser, db, makePremium } from "./helpers";
import { submitAnswer } from "@/lib/server/answers";
import { getPublicQuestions } from "@/lib/server/questions";
import { getDailyIds } from "@/lib/server/daily";
import { startTraining } from "@/lib/server/study";
import { ensureOfficialSimulado, FREE_OFFICIAL_QUESTIONS, listOfficialExams, startOfficialRound } from "@/lib/server/official";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const createdExams: string[] = [];

// Não deixa provas de teste no banco, para não aparecerem na lista de provas do app local.
afterAll(async () => {
  if (!createdExams.length) return;
  await db().from("questions").delete().in("official_exam_id", createdExams);
  await db().from("official_exams").delete().in("id", createdExams);
});

async function createExam() {
  const id = `teste-${randomUUID()}`;
  createdExams.push(id);
  const { error } = await db()
    .from("official_exams")
    .insert({ id, track_id: "enamed", board: "Inep", name: "ENAMED 2025", year: 2025, booklet: "Caderno 01", key_status: "definitivo" });
  if (error) throw error;
  return id;
}

describe("provas oficiais", () => {
  it("mostra prova, número e figuras da questão oficial", async () => {
    const exam = await createExam();
    const [q] = await createQuestions(1, "clinica", {
      origin: "oficial_inep",
      license: "liberado",
      official_exam_id: exam,
      official_number: 37,
      images: [{ src: "enamed-2025/q37-ecg.png", alt: "Eletrocardiograma de 12 derivações do paciente" }],
    });
    const [pub] = await getPublicQuestions([q.id]);
    expect(pub.official).toMatchObject({ name: "ENAMED 2025", number: 37, booklet: "Caderno 01", keyStatus: "definitivo" });
    expect(pub.images?.[0].src).toMatch(/\/storage\/v1\/object\/public\/question-media\/enamed-2025\/q37-ecg\.png$/);
    expect(pub.outdatedNote).toBeNull();
  });

  it("não deixa repetir o número dentro da mesma prova", async () => {
    const exam = await createExam();
    await createQuestions(1, "clinica", { official_exam_id: exam, official_number: 5 });
    await expect(createQuestions(1, "clinica", { official_exam_id: exam, official_number: 5 })).rejects.toThrow();
  });

  it("deixa anulada, desatualizada e sem licença fora do Plantão e do Treino", async () => {
    const exam = await createExam();
    const [ok] = await createQuestions(1, "clinica", { license: "liberado", official_exam_id: exam, official_number: 1 });
    const [annulled] = await createQuestions(1, "clinica", { license: "liberado", official_exam_id: exam, official_number: 2, annulled: true });
    const [outdated] = await createQuestions(1, "clinica", { license: "liberado", official_exam_id: exam, official_number: 3, outdated_note: "Diretriz nova." });
    const [pending] = await createQuestions(1, "clinica", { license: "pendente", official_exam_id: exam, official_number: 4 });

    const day = `2099-01-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`;
    await clearDaily(day);
    const daily = await getDailyIds(day);
    // O sorteio pega uma amostra do banco; aqui só importa quem nunca pode entrar.
    expect(ok.id).toBeTruthy();
    for (const q of [annulled, outdated, pending]) expect(daily).not.toContain(q.id);

    const user = await createUser();
    await makePremium(user.id);
    const training = await startTraining(user.id, { areaId: "clinica", filter: "todas", size: 30 });
    const ids = training.questions.map((q) => q.id);
    for (const q of [annulled, outdated, pending]) expect(ids).not.toContain(q.id);
  });

  it("recusa resposta em questão anulada", async () => {
    const exam = await createExam();
    const [q] = await createQuestions(1, "clinica", { official_exam_id: exam, official_number: 9, annulled: true });
    const user = await createUser();
    await expect(submitAnswer(user.id, { questionId: q.id, mode: "training", context: randomUUID(), selected: 0 })).rejects.toThrow(/anulada/);
  });

  it("grátis resolve só a amostra; assinante continua de onde parou, na ordem do caderno", async () => {
    const exam = await createExam();
    const qs = [];
    for (let n = 1; n <= FREE_OFFICIAL_QUESTIONS + 3; n++) {
      const [q] = await createQuestions(1, "clinica", { license: "liberado", official_exam_id: exam, official_number: n });
      qs.push(q);
    }
    const free = await createUser();
    const sample = await startOfficialRound(free.id, exam, 100);
    expect(sample.sampleOnly).toBe(true);
    expect(sample.questions.map((q) => q.id)).toEqual(qs.slice(0, FREE_OFFICIAL_QUESTIONS).map((q) => q.id));

    const paid = await createUser();
    await makePremium(paid.id);
    await submitAnswer(paid.id, { questionId: qs[0].id, mode: "training", context: randomUUID(), selected: qs[0].correct });
    const round = await startOfficialRound(paid.id, exam, 5);
    expect(round.questions.map((q) => q.official?.number)).toEqual([2, 3, 4, 5, 6]);

    const listed = (await listOfficialExams(paid.id)).find((e) => e.id === exam);
    expect(listed).toMatchObject({ total: FREE_OFFICIAL_QUESTIONS + 3, answered: 1, correct: 1 });
  });

  it("cria um simulado da prova real, uma vez só, sem as anuladas e só para assinante", async () => {
    const exam = await createExam();
    const all = [];
    for (let n = 1; n <= 12; n++) {
      const [q] = await createQuestions(1, "clinica", { license: "liberado", official_exam_id: exam, official_number: n, annulled: n === 12 });
      all.push(q);
    }
    const free = await createUser();
    await expect(ensureOfficialSimulado(free.id, exam)).rejects.toThrow(/assinatura/);

    const paid = await createUser();
    await makePremium(paid.id);
    const id = await ensureOfficialSimulado(paid.id, exam);
    expect(await ensureOfficialSimulado(paid.id, exam)).toBe(id);

    const { data: sim } = await db().from("simulados").select("*").eq("id", id).single();
    expect(sim.question_ids).toEqual(all.slice(0, 11).map((q) => q.id));
    expect(sim.published).toBe(true);
    expect(sim.duration_minutes).toBe(33);
    await db().from("simulados").delete().eq("id", id);
  });
});
