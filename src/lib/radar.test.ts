import { describe, expect, it } from "vitest";
import { CHANGES, classify, daysBetween, EVENTS } from "./radar";

describe("radar do edital", () => {
  it("conta os dias até um evento", () => {
    expect(daysBetween("2026-11-16", "2026-12-04")).toBe(18);
    expect(daysBetween("2026-12-04", "2026-11-16")).toBe(-18);
  });

  it("separa o que já passou, o próximo e o que vem depois", () => {
    const list = classify(EVENTS, "2026-11-16");
    expect(list.find((e) => e.id === "enamed-prova")?.status).toBe("passou");
    expect(list.find((e) => e.id === "enamed-resultado")?.status).toBe("proximo");
    expect(list.find((e) => e.id === "enare-escolha-vagas")?.status).toBe("futuro");
    expect(list.filter((e) => e.status === "proximo")).toHaveLength(1);
  });

  it("no próprio dia o evento ainda conta como próximo", () => {
    const list = classify(EVENTS, "2026-12-04");
    expect(list.find((e) => e.id === "enamed-resultado")).toMatchObject({ status: "proximo", daysLeft: 0 });
  });

  it("depois de tudo, nada fica como próximo", () => {
    expect(classify(EVENTS, "2027-12-31").some((e) => e.status === "proximo")).toBe(false);
  });

  it("todo item tem fonte com endereço e texto", () => {
    for (const item of [...EVENTS, ...CHANGES]) {
      expect(item.source.url).toMatch(/^https:\/\//);
      expect(item.detail.length).toBeGreaterThan(20);
    }
  });

  it("não deixa data de portal passar por oficial", () => {
    const portais = EVENTS.filter((e) => e.source.url.includes("medway.com.br"));
    expect(portais.length).toBeGreaterThan(0);
    for (const e of portais) expect(e.confidence).not.toBe("oficial");
  });
});
