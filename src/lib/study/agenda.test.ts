import { describe, expect, it } from "vitest";
import { addDays, agendaLabel, buildAgenda } from "./agenda";

describe("agenda de revisão", () => {
  it("soma dias atravessando o fim do mês e do ano", () => {
    expect(addDays("2026-11-29", 2)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("conta por dia e põe as atrasadas em hoje", () => {
    const agenda = buildAgenda(["2026-11-01", "2026-11-11", "2026-11-12", "2026-11-12", "2026-11-17"], "2026-11-11");
    expect(agenda).toHaveLength(7);
    expect(agenda[0]).toEqual({ day: "2026-11-11", count: 2 });
    expect(agenda[1]).toEqual({ day: "2026-11-12", count: 2 });
    expect(agenda[6]).toEqual({ day: "2026-11-17", count: 1 });
  });

  it("ignora o que volta depois da janela", () => {
    const agenda = buildAgenda(["2026-11-18", "2027-02-01"], "2026-11-11");
    expect(agenda.reduce((sum, entry) => sum + entry.count, 0)).toBe(0);
  });

  it("nomeia hoje, amanhã e o dia da semana", () => {
    expect(agendaLabel("2026-11-11", 0)).toBe("Hoje");
    expect(agendaLabel("2026-11-12", 1)).toBe("Amanhã");
    expect(agendaLabel("2026-11-13", 2)).toBe("Sex");
  });
});
