import { describe, expect, it } from "vitest";
import { buildJourney, journeyStage, type JourneyInput } from "./journey";

const base: JourneyInput = {
  premium: true,
  dailyTotal: 10,
  dailyAnswered: 0,
  dailyHits: 0,
  dueReviews: 0,
  extraMissionsDone: 0,
  extraMissionsTotal: 2,
  nextMissionText: "Responda 10 questões",
};

describe("journeyStage", () => {
  it("separa novo, nivelamento e ativo", () => {
    expect(journeyStage({ answered: 0, ratedGames: 0 })).toBe("novo");
    expect(journeyStage({ answered: 1, ratedGames: 1 })).toBe("nivelamento");
    expect(journeyStage({ answered: 30, ratedGames: 19 })).toBe("nivelamento");
    expect(journeyStage({ answered: 30, ratedGames: 20 })).toBe("ativo");
  });
});

describe("buildJourney", () => {
  it("manda fazer o Plantão primeiro", () => {
    const j = buildJourney(base);
    expect(j.next.title).toBe("Faça o Plantão de hoje");
    expect(j.next.href).toBe("/app/plantao");
    expect(j.steps.map((s) => s.state)).toEqual(["now", "clear", "next"]);
  });

  it("continua o Plantão começado e diz quantas faltam", () => {
    const j = buildJourney({ ...base, dailyAnswered: 7 });
    expect(j.next.title).toBe("Termine o Plantão de hoje");
    expect(j.next.text).toContain("Faltam 3 questões");
    expect(j.next.cta).toBe("Continuar");
  });

  it("depois do Plantão, manda revisar quando há revisões", () => {
    const j = buildJourney({ ...base, dailyAnswered: 10, dailyHits: 8, dueReviews: 4 });
    expect(j.next.title).toBe("Revise 4 questões");
    expect(j.next.href).toBe("/app/revisao");
    expect(j.steps[0].detail).toBe("Concluído: 8 de 10 certas.");
  });

  it("singular na revisão de uma questão", () => {
    const j = buildJourney({ ...base, dailyAnswered: 10, dueReviews: 1 });
    expect(j.next.title).toBe("Revise 1 questão");
  });

  it("depois do Plantão e sem revisão, propõe a missão", () => {
    const j = buildJourney({ ...base, dailyAnswered: 10, dailyHits: 10 });
    expect(j.next.title).toBe("Responda 10 questões");
    expect(j.next.href).toBe("/app/treino");
  });

  it("fecha o dia quando tudo está feito", () => {
    const j = buildJourney({ ...base, dailyAnswered: 10, extraMissionsDone: 2 });
    expect(j.next.allDone).toBe(true);
    expect(j.next.title).toBe("Hoje está feito");
    expect(j.remaining).toBe(0);
  });

  it("no plano grátis, revisão e missões ficam trancadas e o dia fecha só com o Plantão", () => {
    const before = buildJourney({ ...base, premium: false });
    expect(before.steps.map((s) => s.state)).toEqual(["now", "locked", "locked"]);
    expect(before.steps[1].href).toBeNull();
    const after = buildJourney({ ...base, premium: false, dailyAnswered: 10 });
    expect(after.next.allDone).toBe(true);
    expect(after.next.cta).toBeNull();
  });

  it("sem questões publicadas, não há passo atual", () => {
    const j = buildJourney({ ...base, dailyTotal: 0, premium: false });
    expect(j.steps[0].state).toBe("locked");
    expect(j.next.allDone).toBe(true);
  });

  it("a missão de revisão leva à Revisão, não ao Treino", () => {
    const j = buildJourney({ ...base, dailyAnswered: 10, nextMissionText: "Revise 5 questões do caderno de erros", nextMissionHref: "/app/revisao" });
    expect(j.steps[2].href).toBe("/app/revisao");
  });

  it("revisão sem pendência fica em dia, não feita, e não conta como passo", () => {
    const j = buildJourney(base);
    expect(j.steps[1].state).toBe("clear");
    expect(j.remaining).toBe(2);
  });

  it("conta quantos passos faltam", () => {
    expect(buildJourney(base).remaining).toBe(2);
    expect(buildJourney({ ...base, dueReviews: 3 }).remaining).toBe(3);
  });
});
