import { describe, expect, it } from "vitest";
import { discriminationBucket, expectedScore, itemRatingAfter, PLACEMENT_GAMES, ratingDelta, tierOf } from "./rating";
import { levelOf, xpForAnswer, xpForDaily, xpForSimulado } from "./xp";
import { displayedStreak, MAX_SHIELDS, nextStreak, todayBR } from "./streak";
import { ACHIEVEMENTS, missionsFor, unlockedAchievements, type LifetimeStats } from "./progress";

describe("rating", () => {
  it("dá mais pontos por acertar questão difícil do que fácil", () => {
    expect(ratingDelta(1200, 1500, true, 100)).toBeGreaterThan(ratingDelta(1200, 1100, true, 100));
  });
  it("tira mais pontos por errar questão fácil do que difícil", () => {
    expect(ratingDelta(1200, 1100, false, 100)).toBeLessThan(ratingDelta(1200, 1500, false, 100));
  });
  it("sempre muda ao menos 1 ponto", () => {
    expect(ratingDelta(2000, 700, true, 100)).toBe(1);
    expect(ratingDelta(700, 2000, false, 100)).toBe(-1);
  });
  it("protege o iniciante durante o nivelamento", () => {
    expect(ratingDelta(1500, 900, false, 0)).toBeGreaterThanOrEqual(-12);
    expect(ratingDelta(900, 1300, true, 0)).toBeGreaterThan(ratingDelta(900, 1300, true, PLACEMENT_GAMES));
  });
  it("calcula expectativa de 50% entre iguais", () => {
    expect(expectedScore(1300, 1300)).toBeCloseTo(0.5);
  });
  it("torna a questão mais difícil quando erram e mais fácil quando acertam", () => {
    expect(itemRatingAfter(1300, 1300, false)).toBeGreaterThan(1300);
    expect(itemRatingAfter(1300, 1300, true)).toBeLessThan(1300);
  });
  it("identifica a patente pelos limites", () => {
    expect(tierOf(999).tier.name).toBe("Bronze");
    expect(tierOf(1000).tier.name).toBe("Prata");
    expect(tierOf(1800).tier.name).toBe("Grão-Mestre");
    expect(tierOf(1800).next).toBeNull();
  });
  it("só conta grupos de discriminação depois do nivelamento", () => {
    expect(discriminationBucket(1500, 3)).toBeNull();
    expect(discriminationBucket(1500, 50)).toBe("upper");
    expect(discriminationBucket(900, 50)).toBe("lower");
    expect(discriminationBucket(1200, 50)).toBeNull();
  });
});

describe("xp e níveis", () => {
  it("dá XP por tentar, mesmo errando", () => {
    const entries = xpForAnswer({ questionId: "q", mode: "training", context: "c", correct: false });
    expect(entries.reduce((s, e) => s + e.amount, 0)).toBeGreaterThan(0);
  });
  it("gera referências únicas por origem, para não pontuar duas vezes", () => {
    const a = xpForAnswer({ questionId: "q", mode: "daily", context: "2026-11-09", correct: true });
    expect(new Set(a.map((e) => e.kind + e.ref)).size).toBe(a.length);
  });
  it("revisar vale mais que tentar, para premiar o que ensina", () => {
    const review = xpForAnswer({ questionId: "q", mode: "review", context: "d", correct: false })[0].amount;
    const attempt = xpForAnswer({ questionId: "q", mode: "training", context: "d", correct: false })[0].amount;
    expect(review).toBeGreaterThan(attempt);
  });
  it("só dá bônus de plantão perfeito com todas certas", () => {
    expect(xpForDaily("d", 9, 10).length).toBe(1);
    expect(xpForDaily("d", 10, 10).length).toBe(2);
  });
  it("calcula XP do simulado", () => {
    expect(xpForSimulado(60)).toBe(400);
  });
  it("calcula nível e progresso", () => {
    expect(levelOf(0).current.name).toBe("Doutorando");
    expect(levelOf(350).current.name).toBe("Interno");
    expect(levelOf(350).progress).toBeCloseTo(0.5);
    expect(levelOf(9999).next).toBeNull();
  });
});

describe("sequência", () => {
  const base = { current: 3, best: 5, last_active: "2026-11-05", shields: 1 };
  it("não muda se já estudou hoje", () => {
    expect(nextStreak(base, "2026-11-05").current).toBe(3);
  });
  it("soma em dias seguidos", () => {
    expect(nextStreak(base, "2026-11-06").current).toBe(4);
  });
  it("usa o escudo para cobrir uma falta", () => {
    const r = nextStreak(base, "2026-11-07");
    expect(r.current).toBe(4);
    expect(r.shields).toBe(0);
    expect(r.usedShield).toBe(true);
  });
  it("zera sem escudo ou com falta maior", () => {
    expect(nextStreak({ ...base, shields: 0 }, "2026-11-07").current).toBe(1);
    expect(nextStreak(base, "2026-11-08").current).toBe(1);
  });
  it("ganha escudo a cada 7 dias, até o máximo", () => {
    const r = nextStreak({ current: 6, best: 6, last_active: "2026-11-05", shields: 0 }, "2026-11-06");
    expect(r.earnedShield).toBe(true);
    const max = nextStreak({ current: 6, best: 6, last_active: "2026-11-05", shields: MAX_SHIELDS }, "2026-11-06");
    expect(max.shields).toBe(MAX_SHIELDS);
  });
  it("mantém o recorde", () => {
    expect(nextStreak({ ...base, current: 5, last_active: "2026-11-05" }, "2026-11-06").best).toBe(6);
    expect(nextStreak({ ...base, shields: 0 }, "2026-11-20").best).toBe(5);
  });
  it("mostra sequência zerada quando já foi perdida", () => {
    expect(displayedStreak(base, "2026-11-06")).toBe(3);
    expect(displayedStreak({ ...base, shields: 0 }, "2026-11-07")).toBe(0);
    expect(displayedStreak(base, "2026-11-07")).toBe(3);
    expect(displayedStreak(base, "2026-11-09")).toBe(0);
  });
  it("usa o fuso de Brasília na virada do dia", () => {
    expect(todayBR(new Date("2026-11-09T02:30:00Z"))).toBe("2026-11-08");
    expect(todayBR(new Date("2026-11-09T03:30:00Z"))).toBe("2026-11-09");
  });
});

describe("missões e conquistas", () => {
  const empty = { answered: 0, correct: 0, dailyDone: false, reviews: 0, diagnosed: 0, areasTouched: 0 };
  it("sempre inclui o Plantão do Dia e três missões distintas", () => {
    const m = missionsFor("2026-11-09", empty);
    expect(m[0].id).toBe("m_daily");
    expect(new Set(m.map((x) => x.id)).size).toBe(3);
  });
  it("é igual para todos no mesmo dia", () => {
    expect(missionsFor("2026-11-09", empty).map((x) => x.id)).toEqual(missionsFor("2026-11-09", empty).map((x) => x.id));
  });
  it("limita o progresso à meta", () => {
    const m = missionsFor("2026-11-09", { ...empty, answered: 999, correct: 999, reviews: 999, diagnosed: 999, areasTouched: 9 });
    for (const x of m.slice(1)) {
      expect(x.current).toBe(x.goal);
      expect(x.done).toBe(true);
    }
  });
  const stats: LifetimeStats = {
    answered: 100, correct: 50, bestStreak: 7, bestCombo: 3, reviews: 0, diagnosed: 0,
    simulados: 0, comments: 0, commentVotes: 0, rating: 900, dailyPerfect: 0,
  };
  it("libera conquistas atingidas e não repete as já ganhas", () => {
    expect(unlockedAchievements(stats, new Set())).toEqual(expect.arrayContaining(["primeiro_plantao", "cem", "semana"]));
    expect(unlockedAchievements(stats, new Set(["cem"]))).not.toContain("cem");
  });
  it("tem ids únicos", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
