import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_MASCOT, findMascot, MASCOTS, resolveMascot } from "./mascots";

describe("companheiros de jornada", () => {
  it("oferece os oito personagens com nomes e imagens próprios", () => {
    expect(MASCOTS).toHaveLength(8);
    expect(new Set(MASCOTS.map((mascot) => mascot.id)).size).toBe(8);
    expect(new Set(MASCOTS.map((mascot) => mascot.name)).size).toBe(8);
    for (const mascot of MASCOTS) {
      expect(mascot.name).toMatch(/^Dr(?:a)?\. /);
      expect(existsSync(`public${mascot.image}`)).toBe(true);
    }
  });

  it("mantém contas antigas e dados inválidos com um personagem disponível", () => {
    for (const character of [undefined, null, "doc", "cirurgia", "<script>"]) {
      expect(resolveMascot(character)).toBe(DEFAULT_MASCOT);
      expect(findMascot(character)).toBeUndefined();
    }
    expect(resolveMascot("helena").name).toBe("Dra. Helena");
  });
});
