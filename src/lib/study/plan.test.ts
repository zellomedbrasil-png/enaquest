import { describe, expect, it } from "vitest";
import { buildPlan, type PlanArea } from "./plan";

const areas: PlanArea[] = [
  { id: "clinica", name: "Clínica", color: "#000", share: 0.18 },
  { id: "pediatria", name: "Pediatria", color: "#000", share: 0.16 },
  { id: "coletiva", name: "Coletiva", color: "#000", share: 0.12 },
];
const base = { today: "2026-11-16", examDate: "2027-09-12", hoursPerWeek: 20, weakAreas: [], areas };

describe("plano de estudo", () => {
  it("recusa prova a menos de uma semana ou no passado", () => {
    expect(buildPlan({ ...base, examDate: "2026-11-20" })).toBeNull();
    expect(buildPlan({ ...base, examDate: "2026-01-01" })).toBeNull();
  });

  it("divide as semanas em fases que somam o total", () => {
    const plan = buildPlan(base)!;
    expect(plan.weeks).toBe(42);
    expect(plan.phases.map((p) => p.key)).toEqual(["base", "consolidacao", "reta"]);
    expect(plan.phases.reduce((sum, p) => sum + p.weeks, 0)).toBe(plan.weeks);
    expect(plan.phases.at(-1)!.weeks).toBeGreaterThanOrEqual(2);
  });

  it("prazo curto vira reta final e consolidação, sem fase de base", () => {
    const plan = buildPlan({ ...base, examDate: "2026-12-14" })!;
    expect(plan.weeks).toBe(4);
    expect(plan.phases.map((p) => p.key)).not.toContain("base");
    expect(plan.phases.reduce((sum, p) => sum + p.weeks, 0)).toBe(4);
  });

  it("dá mais tempo à área marcada como difícil", () => {
    const normal = buildPlan(base)!;
    const weak = buildPlan({ ...base, weakAreas: ["coletiva"] })!;
    const pct = (plan: typeof normal) => plan.areas.find((a) => a.id === "coletiva")!.pct;
    expect(pct(weak)).toBeGreaterThan(pct(normal));
    expect(weak.areas.find((a) => a.id === "coletiva")!.weak).toBe(true);
  });

  it("calcula questões por semana pelo ritmo informado", () => {
    const plan = buildPlan(base)!;
    expect(plan.questionsPerWeek).toBe(150);
    expect(plan.totalQuestions).toBe(150 * 42);
  });
});
