import { describe, expect, it } from "vitest";
import { pickBalanced, pickReviewSample, quotas, seededShuffle } from "./selection";

const areas = [
  { id: "clinica", exam_share: 0.18 },
  { id: "pediatria", exam_share: 0.16 },
  { id: "go", exam_share: 0.15 },
  { id: "cirurgia", exam_share: 0.14 },
  { id: "mental", exam_share: 0.14 },
  { id: "coletiva", exam_share: 0.12 },
  { id: "mfc", exam_share: 0.11 },
];

const pool = areas.flatMap((a) => Array.from({ length: 20 }, (_, i) => ({ id: `${a.id}-${i}`, area_id: a.id })));

describe("sorteios", () => {
  it("reproduz a proporção real em 100 questões", () => {
    expect(quotas(areas, 100)).toEqual({ clinica: 18, pediatria: 16, go: 15, cirurgia: 14, mental: 14, coletiva: 12, mfc: 11 });
  });
  it("sempre soma o tamanho pedido", () => {
    for (const size of [1, 7, 10, 33, 100]) {
      expect(Object.values(quotas(areas, size)).reduce((a, b) => a + b, 0)).toBe(size);
    }
  });
  it("é igual para a mesma semente e muda com outra", () => {
    expect(pickBalanced(pool, areas, "2026-11-09", 10)).toEqual(pickBalanced(pool, areas, "2026-11-09", 10));
    expect(pickBalanced(pool, areas, "2026-11-09", 10)).not.toEqual(pickBalanced(pool, areas, "2026-11-10", 10));
  });
  it("não repete questão e cobre várias áreas", () => {
    const picked = pickBalanced(pool, areas, "x", 10);
    expect(new Set(picked).size).toBe(10);
    expect(new Set(picked.map((id) => id.split("-")[0])).size).toBeGreaterThanOrEqual(5);
  });
  it("completa quando uma área não tem questões", () => {
    const small = pool.filter((q) => q.area_id !== "clinica");
    expect(pickBalanced(small, areas, "x", 10).length).toBe(10);
  });
  it("devolve tudo quando o banco é menor que o pedido", () => {
    expect(pickBalanced(pool.slice(0, 3), areas, "x", 10).length).toBe(3);
  });
  it("embaralha sem perder itens", () => {
    expect(seededShuffle([1, 2, 3, 4], "a").sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("amostra de revisão", () => {
  const questions = Array.from({ length: 300 }, (_, i) => ({ id: `q${i}`, risk_level: i < 50 ? "alto" : "normal" }));
  it("sorteia 59 sem repetir", () => {
    const sample = pickReviewSample(questions, "lote", 59);
    expect(sample.length).toBe(59);
    expect(new Set(sample).size).toBe(59);
  });
  it("dá peso maior ao alto risco", () => {
    const sample = pickReviewSample(questions, "lote", 59);
    const high = sample.filter((id) => Number(id.slice(1)) < 50).length;
    expect(high).toBeGreaterThanOrEqual(24);
  });
  it("revisa tudo quando o lote é pequeno", () => {
    expect(pickReviewSample(questions.slice(0, 40), "lote", 59).length).toBe(40);
  });
  it("funciona sem alto risco", () => {
    expect(pickReviewSample(questions.slice(60), "lote", 59).length).toBe(59);
  });
});
