import { describe, expect, it } from "vitest";
import { achievementProgress, closestAchievements, type LifetimeStats } from "./progress";
import { addDays } from "./streak";

const stats: LifetimeStats = {
  answered: 80,
  correct: 50,
  bestStreak: 3,
  bestCombo: 4,
  reviews: 0,
  diagnosed: 0,
  simulados: 0,
  comments: 0,
  commentVotes: 0,
  rating: 900,
  dailyPerfect: 0,
};

describe("progresso de conquistas", () => {
  it("calcula a fração e limita ao objetivo", () => {
    const list = achievementProgress({ ...stats, answered: 250 }, new Set());
    const cem = list.find((a) => a.id === "cem")!;
    expect(cem.pct).toBe(1);
    expect(cem.current).toBe(100);
    expect(list.find((a) => a.id === "mil")!.pct).toBeCloseTo(0.25);
  });

  it("marca como completa a que já foi ganha, mesmo com estatística menor", () => {
    const list = achievementProgress(stats, new Set(["mes"]));
    const mes = list.find((a) => a.id === "mes")!;
    expect(mes.unlocked).toBe(true);
    expect(mes.pct).toBe(1);
  });

  it("a conquista de rating começa do rating inicial, não de zero", () => {
    const platina = achievementProgress({ ...stats, rating: 900 }, new Set()).find((a) => a.id === "platina")!;
    expect(platina.pct).toBe(0);
    const meio = achievementProgress({ ...stats, rating: 1100 }, new Set()).find((a) => a.id === "platina")!;
    expect(meio.pct).toBeCloseTo(0.5);
  });

  it("lista as mais próximas primeiro e ignora as ganhas e as sem progresso", () => {
    const list = achievementProgress(stats, new Set(["primeiro_plantao"]));
    const closest = closestAchievements(list, 3);
    expect(closest).toHaveLength(3);
    expect(closest[0].id).toBe("cem");
    expect(closest.every((a) => !a.unlocked && a.pct > 0)).toBe(true);
    expect(closest.map((a) => a.pct)).toEqual([...closest.map((a) => a.pct)].sort((a, b) => b - a));
  });
});

describe("addDays", () => {
  it("anda para trás e para frente atravessando mês e ano", () => {
    expect(addDays("2026-11-09", -6)).toBe("2026-11-03");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
