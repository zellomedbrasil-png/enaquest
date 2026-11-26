import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planDay, TemarioSchema } from "./daily-plan";
import { extractJson } from "./llm";

const temario = TemarioSchema.parse(JSON.parse(readFileSync("content/temas/temario.json", "utf8")));
const catalog = new Set(
  (JSON.parse(readFileSync("content/sources/catalogo.json", "utf8")).sources as { id: string }[]).map((s) => s.id),
);

describe("temário", () => {
  it("só cita fontes que existem no catálogo", () => {
    const missing = Object.values(temario.temas).flatMap((themes) => themes.flatMap((t) => t.fontes.filter((id) => !catalog.has(id))));
    expect(missing).toEqual([]);
  });
});

describe("plano do dia", () => {
  it("segue a proporção das áreas e o tamanho pedido", () => {
    const plan = planDay(temario, {}, 20, "2026-11-26");
    expect(plan).toHaveLength(20);
    const byArea = plan.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.area_id]: (acc[p.area_id] ?? 0) + 1 }), {});
    expect(byArea.clinica).toBeGreaterThanOrEqual(byArea.mfc);
    expect(Object.keys(byArea)).toHaveLength(7);
  });

  it("é igual para o mesmo dia e prefere temas pouco usados", () => {
    expect(planDay(temario, {}, 20, "2026-11-26")).toEqual(planDay(temario, {}, 20, "2026-11-26"));
    const usage = Object.fromEntries(temario.temas.clinica.slice(0, -1).map((t) => [t.tema, 5]));
    const clinica = planDay(temario, usage, 20, "2026-11-26").filter((p) => p.area_id === "clinica");
    expect(clinica[0].theme).toBe(temario.temas.clinica.at(-1)!.tema);
  });

  it("não repete tema no mesmo dia enquanto houver tema livre", () => {
    const plan = planDay(temario, {}, 20, "2026-11-27");
    expect(new Set(plan.map((p) => p.theme)).size).toBe(plan.length);
  });
});

describe("resposta do modelo", () => {
  it("acha o JSON mesmo com cercas ou texto em volta", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Aqui está:\n{"a":{"b":2}}\nFim.')).toEqual({ a: { b: 2 } });
    expect(() => extractJson("sem json")).toThrow();
  });
});
