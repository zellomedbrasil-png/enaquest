import { describe, expect, it } from "vitest";
import { estimateTheta, MIN_RESPONSES, proficiency, type Response } from "./proficiency";

const make = (n: number, rate: number, itemRating = 1300): Response[] =>
  Array.from({ length: n }, (_, i) => ({ itemRating, correct: i < n * rate }));

describe("Termômetro de Proficiência", () => {
  it("não mostra estimativa antes do mínimo de respostas", () => {
    const r = proficiency(make(MIN_RESPONSES - 1, 0.7), { calibrated: false });
    expect(r.ready).toBe(false);
    expect(r.needed).toBe(1);
    expect(r.expected).toBeNull();
  });
  it("estima mais para quem acerta mais", () => {
    const low = proficiency(make(100, 0.4), { calibrated: false });
    const high = proficiency(make(100, 0.8), { calibrated: false });
    expect(high.rating!).toBeGreaterThan(low.rating!);
    expect(high.expected!).toBeGreaterThan(low.expected!);
  });
  it("mostra faixa que contém a estimativa", () => {
    const r = proficiency(make(100, 0.6), { calibrated: false });
    expect(r.low!).toBeLessThan(r.expected!);
    expect(r.high!).toBeGreaterThan(r.expected!);
  });
  it("estreita a faixa com mais respostas", () => {
    const few = proficiency(make(50, 0.6), { calibrated: false });
    const many = proficiency(make(500, 0.6), { calibrated: false });
    expect(many.high! - many.low!).toBeLessThan(few.high! - few.low!);
  });
  it("valoriza acerto em questões difíceis", () => {
    const easy = estimateTheta(make(60, 0.6, 1100)).theta;
    const hard = estimateTheta(make(60, 0.6, 1500)).theta;
    expect(hard).toBeGreaterThan(easy);
  });
  it("não inventa chance de proficiência sem calibração", () => {
    expect(proficiency(make(100, 0.9), { calibrated: false }).chanceProficient).toBeNull();
  });
  it("calcula a chance apenas quando calibrado", () => {
    const r = proficiency(make(200, 0.8), { calibrated: true, cut_theta: 0 });
    expect(r.chanceProficient!).toBeGreaterThan(50);
    const b = proficiency(make(200, 0.3), { calibrated: true, cut_theta: 0 });
    expect(b.chanceProficient!).toBeLessThan(50);
  });
  it("converge mesmo com tudo certo ou tudo errado", () => {
    expect(Number.isFinite(proficiency(make(60, 1), { calibrated: false }).rating)).toBe(true);
    expect(Number.isFinite(proficiency(make(60, 0), { calibrated: false }).rating)).toBe(true);
  });
});
