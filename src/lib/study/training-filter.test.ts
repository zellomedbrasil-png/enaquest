import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterPool, themesByArea, type PoolQuestion, type TrainingHistory } from "./training-filter";

const pool: PoolQuestion[] = [
  { id: "a", area_id: "clinica", theme: "Sepse", difficulty: "facil", official_exam_id: null, has_images: false },
  { id: "b", area_id: "clinica", theme: "Sepse", difficulty: "dificil", official_exam_id: "enamed-2025-c1", has_images: true },
  { id: "c", area_id: "clinica", theme: "Asma", difficulty: "medio", official_exam_id: null, has_images: false },
  { id: "d", area_id: "pediatria", theme: "Bronquiolite", difficulty: "medio", official_exam_id: "enamed-2025-c1", has_images: false },
  { id: "e", area_id: "go", theme: "Pré-natal", difficulty: "muito_dificil", official_exam_id: null, has_images: false },
];

const history: TrainingHistory = {
  last: new Map([
    ["a", { correct: false, confidence: "certeza" }],
    ["c", { correct: true, confidence: "chute" }],
    ["d", { correct: true, confidence: "certeza" }],
  ]),
  marked: new Set(["e"]),
};

const ids = (filters: Partial<typeof DEFAULT_FILTERS>) => filterPool(pool, history, { ...DEFAULT_FILTERS, ...filters }).map((q) => q.id);

describe("filtros do Treino", () => {
  it("por padrão traz só as questões nunca respondidas", () => {
    expect(ids({})).toEqual(["b", "e"]);
  });
  it("filtra por área e tema", () => {
    expect(ids({ status: "todas", areaId: "clinica" })).toEqual(["a", "b", "c"]);
    expect(ids({ status: "todas", areaId: "clinica", theme: "Sepse" })).toEqual(["a", "b"]);
  });
  it("separa autorais e uma prova oficial", () => {
    expect(ids({ status: "todas", source: "autorais" })).toEqual(["a", "c", "e"]);
    expect(ids({ status: "todas", source: "prova:enamed-2025-c1" })).toEqual(["b", "d"]);
  });
  it("aceita várias dificuldades ao mesmo tempo", () => {
    expect(ids({ status: "todas", difficulties: ["dificil", "muito_dificil"] })).toEqual(["b", "e"]);
  });
  it("só com imagem", () => {
    expect(ids({ status: "todas", withImages: true })).toEqual(["b"]);
  });
  it("situações: errei, acertei sem certeza e marcadas", () => {
    expect(ids({ status: "erradas" })).toEqual(["a"]);
    expect(ids({ status: "inseguras" })).toEqual(["c"]);
    expect(ids({ status: "marcadas" })).toEqual(["e"]);
  });
  it("lista os temas por área do maior para o menor", () => {
    expect(themesByArea(pool).clinica).toEqual([
      { theme: "Sepse", count: 2 },
      { theme: "Asma", count: 1 },
    ]);
  });
});
