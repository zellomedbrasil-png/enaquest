import { describe, expect, it } from "vitest";
import { areaWeight, buildDayPlan, clampMinutes, phaseFor, type DayPlanArea, type DayPlanInput } from "./day-plan";

const areas: DayPlanArea[] = [
  { id: "clinica", name: "Clínica", color: "#000", share: 0.18, pct: 80, n: 40 },
  { id: "pediatria", name: "Pediatria", color: "#000", share: 0.16, pct: 50, n: 30 },
  { id: "go", name: "GO", color: "#000", share: 0.15, pct: 75, n: 20 },
  { id: "cirurgia", name: "Cirurgia", color: "#000", share: 0.14, pct: null, n: 3 },
  { id: "mental", name: "Mental", color: "#000", share: 0.14, pct: 72, n: 15 },
  { id: "coletiva", name: "Coletiva", color: "#000", share: 0.12, pct: 90, n: 12 },
  { id: "mfc", name: "MFC", color: "#000", share: 0.11, pct: 85, n: 11 },
];

function input(overrides: Partial<DayPlanInput> = {}): DayPlanInput {
  return {
    today: "2026-11-27",
    minutes: 120,
    examDate: null,
    plantao: { total: 10, answered: 0 },
    dueReviews: 0,
    errorsToRedo: 0,
    newAvailable: 500,
    areas,
    doneToday: { revisao: 0, erros: 0, novas: 0 },
    simuladoThisWeek: false,
    ...overrides,
  };
}

const block = (plan: ReturnType<typeof buildDayPlan>, kind: string) => plan.blocks.find((b) => b.kind === kind);

describe("Seu dia", () => {
  it("começa sempre pelo Plantão inteiro", () => {
    const plan = buildDayPlan(input());
    expect(plan.blocks[0]).toMatchObject({ kind: "plantao", target: 10, minutes: 40 });
  });

  it("com pouco tempo, o Plantão sozinho ocupa o dia e não entra mais nada novo", () => {
    const plan = buildDayPlan(input({ minutes: 30, dueReviews: 20 }));
    expect(block(plan, "novas")).toBeUndefined();
    expect(block(plan, "revisao")?.target).toBe(0);
    expect(plan.overflowReviews).toBe(20);
    expect(plan.plannedMinutes).toBe(40);
  });

  it("mais tempo vira mais questões novas", () => {
    const short = block(buildDayPlan(input({ minutes: 60 })), "novas")?.target ?? 0;
    const long = block(buildDayPlan(input({ minutes: 180 })), "novas")?.target ?? 0;
    expect(long).toBeGreaterThan(short);
  });

  it("a revisão não passa de 40% do dia e o resto fica para amanhã", () => {
    const plan = buildDayPlan(input({ minutes: 120, dueReviews: 100 }));
    const revisao = block(plan, "revisao")!;
    expect(revisao.minutes).toBeLessThanOrEqual(120 * 0.4);
    expect(plan.overflowReviews).toBe(100 - revisao.target);
  });

  it("erros para refazer não passam de 15% do dia", () => {
    const plan = buildDayPlan(input({ minutes: 180, errorsToRedo: 100 }));
    expect(block(plan, "erros")!.minutes).toBeLessThanOrEqual(180 * 0.15);
  });

  it("não cria bloco de erros quando não há erros", () => {
    expect(block(buildDayPlan(input()), "erros")).toBeUndefined();
  });

  it("não planeja mais questões novas do que existem", () => {
    expect(block(buildDayPlan(input({ minutes: 300, newAvailable: 3 })), "novas")?.target).toBe(3);
  });

  it("o bloco não encolhe enquanto a pessoa avança", () => {
    const before = block(buildDayPlan(input({ dueReviews: 12 })), "revisao")!;
    const after = block(buildDayPlan(input({ dueReviews: 7, doneToday: { revisao: 5, erros: 0, novas: 0 } })), "revisao")!;
    expect(after.target).toBe(before.target);
    expect(after.done).toBe(5);
  });

  it("área fraca recebe mais questões novas do que o peso da prova daria", () => {
    const novas = block(buildDayPlan(input({ minutes: 300 })), "novas")!;
    expect(novas.areaQuotas!.pediatria).toBeGreaterThan(novas.areaQuotas!.clinica);
    expect(Object.values(novas.areaQuotas!).reduce((a, b) => a + b, 0)).toBe(novas.target);
  });

  it("marca áreas fracas e áreas sem evidência", () => {
    const plan = buildDayPlan(input());
    expect(plan.weakAreas).toEqual(["pediatria"]);
    expect(plan.evidenceAreas).toEqual(["cirurgia"]);
    expect(areaWeight(areas[3])).toBeCloseTo(0.14 * 1.2);
  });

  it("na reta final sugere um simulado por semana", () => {
    const reta = buildDayPlan(input({ examDate: "2026-12-04" }));
    expect(reta.phase).toBe("reta");
    expect(block(reta, "simulado")).toBeDefined();
    expect(block(buildDayPlan(input({ examDate: "2026-12-04", simuladoThisWeek: true })), "simulado")).toBeUndefined();
  });

  it("longe da prova está na base e não sugere simulado", () => {
    const plan = buildDayPlan(input({ examDate: "2027-09-15" }));
    expect(plan.phase).toBe("base");
    expect(plan.daysLeft).toBeGreaterThan(200);
    expect(block(plan, "simulado")).toBeUndefined();
  });

  it("ignora data de prova que já passou", () => {
    expect(phaseFor("2026-11-27", "2026-10-01")).toEqual({ daysLeft: null, phase: null });
  });

  it("mantém os minutos dentro dos limites", () => {
    expect(clampMinutes(5)).toBe(15);
    expect(clampMinutes(1000)).toBe(300);
    expect(clampMinutes(Number.NaN)).toBe(60);
  });
});
