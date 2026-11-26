import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { judgeBlind } from "./checks";
import { isFatalApiError } from "./llm";

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

describe("erros da API que valem para o lote inteiro", () => {
  const apiError = (status: number, message: string) =>
    Anthropic.APIError.generate(status, { type: "error", error: { type: "invalid_request_error", message } }, message, new Headers());

  it("sem crédito, chave inválida ou sem permissão param o comando", () => {
    expect(isFatalApiError(apiError(400, "Your credit balance is too low to access the Anthropic API."))).toBe(true);
    expect(isFatalApiError(apiError(401, "invalid x-api-key"))).toBe(true);
    expect(isFatalApiError(apiError(403, "forbidden"))).toBe(true);
  });

  it("erro de uma questão só não para o lote", () => {
    expect(isFatalApiError(apiError(400, "prompt is too long"))).toBe(false);
    expect(isFatalApiError(apiError(529, "overloaded"))).toBe(false);
    expect(isFatalApiError(new Error("qualquer"))).toBe(false);
  });
});
