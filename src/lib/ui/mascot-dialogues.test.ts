import { describe, expect, it } from "vitest";
import { MASCOT_DIALOGUES, clinicalHints, fillLine, pickLine, seedFrom } from "./mascot-dialogues";

describe("falas do mascote", () => {
  it("troca os marcadores", () => {
    expect(fillLine("Letra {option}, +{xp} XP", { option: "B", xp: 12 })).toBe("Letra B, +12 XP");
  });

  it("sorteia de forma estável e alterna a cada evento", () => {
    const lines = MASCOT_DIALOGUES.IDLE_START;
    const seed = seedFrom("questao-1");
    expect(pickLine(lines, seed)).toBe(pickLine(lines, seed));
    expect(pickLine(lines, seed)).not.toBe(pickLine(lines, seed + 1));
  });

  it("põe a pista própria da questão antes das pistas gerais", () => {
    const hints = clinicalHints({ clinicalHint: "Olhe a idade gestacional.", areaId: "go", scenario: "UBS" });
    expect(hints[0]).toBe("Olhe a idade gestacional.");
    expect(hints.some((hint) => hint.includes("UBS"))).toBe(true);
  });

  it("sempre tem pista, mesmo sem área conhecida", () => {
    expect(clinicalHints({}).length).toBeGreaterThan(0);
  });
});
