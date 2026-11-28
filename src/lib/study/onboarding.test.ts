import { describe, expect, it } from "vitest";
import { examDateFromMonth, minutesLabel, monthAvailable, monthOf, questionsFor } from "./onboarding";

describe("data da prova pelo mês", () => {
  it("usa o dia 15 do mês escolhido", () => {
    expect(examDateFromMonth(2027, 3, "2026-11-28")).toBe("2027-03-15");
  });

  it("no mês atual depois do dia 15, usa hoje", () => {
    expect(examDateFromMonth(2026, 11, "2026-11-28")).toBe("2026-11-28");
    expect(examDateFromMonth(2026, 11, "2026-11-02")).toBe("2026-11-15");
  });

  it("recusa mês que já passou e mês inválido", () => {
    expect(examDateFromMonth(2026, 10, "2026-11-28")).toBeNull();
    expect(examDateFromMonth(2027, 13, "2026-11-28")).toBeNull();
    expect(monthAvailable(2026, 1, "2026-11-28")).toBe(false);
    expect(monthAvailable(2026, 12, "2026-11-28")).toBe(true);
  });

  it("lê mês e ano de uma data gravada", () => {
    expect(monthOf("2027-08-15")).toEqual({ year: 2027, month: 8 });
    expect(monthOf(null)).toBeNull();
  });
});

describe("ritmo", () => {
  it("converte minutos em questões e em texto", () => {
    expect(questionsFor(60)).toBe(15);
    expect(questionsFor(30)).toBe(8);
    expect(minutesLabel(90)).toBe("1,5 h");
    expect(minutesLabel(30)).toBe("30 min");
  });
});
