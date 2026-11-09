import { describe, expect, it } from "vitest";
import { Rating } from "ts-fsrs";
import { gradeFor, scheduleCard, shouldSchedule } from "./srs";

const now = new Date("2026-11-09T12:00:00Z");

describe("revisão espaçada", () => {
  it("traduz resultado e confiança em nota", () => {
    expect(gradeFor(false, "certeza")).toBe(Rating.Again);
    expect(gradeFor(true, "chute")).toBe(Rating.Hard);
    expect(gradeFor(true, "duvida")).toBe(Rating.Good);
    expect(gradeFor(true, "certeza")).toBe(Rating.Easy);
  });
  it("agenda erro e acerto sem certeza, e ignora acerto seguro novo", () => {
    expect(shouldSchedule({ correct: false, confidence: "certeza", hasCard: false })).toBe(true);
    expect(shouldSchedule({ correct: true, confidence: "chute", hasCard: false })).toBe(true);
    expect(shouldSchedule({ correct: true, confidence: "certeza", hasCard: false })).toBe(false);
    expect(shouldSchedule({ correct: true, confidence: "certeza", hasCard: true })).toBe(true);
  });
  it("traz o erro de volta antes do acerto", () => {
    const wrong = scheduleCard(null, false, "duvida", now);
    const right = scheduleCard(null, true, "certeza", now);
    expect(new Date(wrong.due).getTime()).toBeLessThan(new Date(right.due).getTime());
  });
  it("aumenta o intervalo depois de acertar de novo, mesmo vindo do banco como JSON", () => {
    const first = scheduleCard(null, true, "duvida", now);
    const stored = JSON.parse(JSON.stringify(first.state));
    const dueDate = new Date(first.due);
    const second = scheduleCard(stored, true, "duvida", dueDate);
    const firstGap = dueDate.getTime() - now.getTime();
    const secondGap = new Date(second.due).getTime() - dueDate.getTime();
    expect(secondGap).toBeGreaterThan(firstGap);
  });
});
