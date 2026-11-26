import { describe, expect, it } from "vitest";
import { judgeBlind } from "./checks";

const blind = (answer_index: number, extra: Partial<{ confident: boolean; other_defensible: number[]; stem_problem: string | null }> = {}) => ({
  answer_index,
  confident: true,
  other_defensible: [],
  stem_problem: null,
  ...extra,
});

describe("resolução às cegas", () => {
  it("passa quando acerta com segurança", () => {
    expect(judgeBlind(blind(1), 1, "resolucao_cega", true)).toEqual({ ok: true });
  });

  it("na questão nova, erro claro descarta", () => {
    expect(judgeBlind(blind(2), 1, "resolucao_cega", true)).toMatchObject({ ok: false, hold: false, reason: "Respondeu C, gabarito B." });
    expect(judgeBlind(blind(1, { other_defensible: [3] }), 1, "resolucao_cega", true)).toMatchObject({ ok: false, hold: false });
  });

  it("no lote já escrito, erro só segura, sem descartar", () => {
    expect(judgeBlind(blind(2), 1, "resolucao_cega", false)).toMatchObject({ ok: false, hold: true });
  });

  it("acertar sem segurança, ou sem resposta, deixa para você olhar", () => {
    expect(judgeBlind(blind(1, { confident: false }), 1, "x", true)).toMatchObject({ ok: false, hold: true });
    expect(judgeBlind(null, 1, "x", true)).toMatchObject({ ok: false, hold: true });
  });
});
