import { describe, expect, it } from "vitest";
import { normalize, segments, toggleRange } from "./highlight";

describe("grifos do enunciado", () => {
  it("junta intervalos que se sobrepõem ou se tocam", () => {
    expect(normalize([[5, 8], [0, 3], [3, 4], [7, 10]])).toEqual([[0, 4], [5, 10]]);
  });

  it("grifa um trecho novo e aceita seleção de trás para frente", () => {
    expect(toggleRange([], [4, 1])).toEqual([[1, 4]]);
  });

  it("apaga o grifo quando o trecho já estava grifado", () => {
    expect(toggleRange([[0, 10]], [3, 6])).toEqual([[0, 3], [6, 10]]);
    expect(toggleRange([[0, 10]], [0, 10])).toEqual([]);
  });

  it("estende o grifo quando o trecho só estava grifado em parte", () => {
    expect(toggleRange([[0, 4]], [2, 8])).toEqual([[0, 8]]);
  });

  it("ignora seleção vazia", () => {
    expect(toggleRange([[1, 2]], [5, 5])).toEqual([[1, 2]]);
  });

  it("quebra o texto em pedaços na ordem", () => {
    expect(segments("Homem de 55 anos", [[9, 11]])).toEqual([
      { text: "Homem de ", marked: false },
      { text: "55", marked: true },
      { text: " anos", marked: false },
    ]);
    expect(segments("abc", [[0, 99]])).toEqual([{ text: "abc", marked: true }]);
  });
});
