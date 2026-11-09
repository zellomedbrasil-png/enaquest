import { describe, expect, it } from "vitest";
import { findDuplicates, keyBalance, lintDraft, lintLot, similarity } from "./lint";
import type { Draft, Lot, LotQuestion } from "./schema";

const good: Draft = {
  stem: "Mulher de 40 anos procura a UBS com tosse há três semanas, febre vespertina e perda de peso. Radiografia mostra lesão cavitária em ápice direito. Qual é o próximo exame para confirmar o diagnóstico?",
  exams: null,
  options: ["Teste rápido molecular no escarro", "Tomografia de tórax com contraste", "Broncoscopia com biópsia transbrônquica", "Sorologia para fungos endêmicos"],
  correct_index: 0,
  quick: "O teste rápido molecular é o exame inicial para confirmar tuberculose pulmonar no SUS.",
  reasoning: "O quadro sugere tuberculose pulmonar. O protocolo orienta o teste molecular como primeiro exame.",
  distractors: [
    { index: 1, why: "A tomografia não confirma o diagnóstico microbiológico." },
    { index: 2, why: "A broncoscopia fica para casos sem amostra adequada." },
    { index: 3, why: "A sorologia para fungos não é prioridade neste quadro." },
  ],
  tip: "Tosse há três semanas pede investigação de tuberculose.",
  pearl: "Baciloscopia negativa não exclui tuberculose quando a suspeita é alta.",
  competency_note: "Escolher o exame confirmatório disponível na atenção primária.",
  claims: [{ claim: "TRM-TB como exame inicial", source_id: "ms-tb", locator: "Cap. 2" }],
};

const codes = (draft: Draft) => lintDraft(draft).map((i) => i.code);

describe("checagem de escrita", () => {
  it("aprova uma questão boa", () => {
    expect(lintDraft(good).filter((i) => i.fatal)).toEqual([]);
  });
  it("exige 4 alternativas, como no ENAMED", () => {
    expect(codes({ ...good, options: [...good.options, "Outra alternativa qualquer"] })).toContain("options_count");
  });
  it("rejeita gabarito fora do intervalo", () => {
    expect(codes({ ...good, correct_index: 4 })).toContain("key_range");
  });
  it("rejeita alternativas repetidas", () => {
    expect(codes({ ...good, options: [good.options[0], good.options[0], good.options[2], good.options[3]] })).toContain("options_duplicate");
  });
  it("rejeita 'todas as anteriores'", () => {
    expect(codes({ ...good, options: [good.options[0], good.options[1], good.options[2], "Todas as anteriores"] })).toContain("option_banned");
  });
  it("rejeita letra no início da alternativa", () => {
    expect(codes({ ...good, options: ["A) Teste rápido", good.options[1], good.options[2], good.options[3]] })).toContain("option_letter");
  });
  it("exige terminar em pergunta", () => {
    expect(codes({ ...good, stem: "Mulher de 40 anos procura a UBS com tosse há três semanas, febre e perda de peso, sem outras queixas relevantes." })).toContain("stem_no_question");
  });
  it("detecta a pista da alternativa certa muito longa", () => {
    const options = ["Solicitar teste rápido molecular em amostra de escarro, além de oferecer teste para HIV e rastrear os contatos do domicílio", "Tomografia", "Broncoscopia", "Sorologia"];
    expect(codes({ ...good, options })).toContain("key_longest");
  });
  it("exige explicar cada alternativa errada", () => {
    expect(codes({ ...good, distractors: good.distractors.slice(0, 2) })).toContain("distractor_missing");
  });
  it("não aceita a correta entre as erradas", () => {
    expect(codes({ ...good, distractors: [...good.distractors, { index: 0, why: "Isso não deveria estar aqui de jeito nenhum" }] })).toContain("distractor_key");
  });
  it("não aceita questão sem fonte", () => {
    expect(codes({ ...good, claims: [] })).toContain("no_claims");
  });
});

describe("checagem do lote", () => {
  const q = (slug: string, correct_index: number, stem = good.stem): LotQuestion => ({
    ...good,
    stem,
    correct_index,
    distractors: [0, 1, 2, 3].filter((i) => i !== correct_index).map((index) => ({ index, why: "Explicação suficiente para esta alternativa errada." })),
    slug,
    area_id: "clinica",
    competency_id: "propedeutica",
    theme: "Tuberculose",
    scenario: "UBS",
    difficulty: "medio",
    risk_level: "normal",
    expires_on: "2028-01-01",
  });
  const source = { id: "ms-tb", title: "Manual", publisher: "MS", year: 2019, url: "https://example.com/x", checked_on: "2026-11-09" };

  it("mede o equilíbrio do gabarito", () => {
    expect(keyBalance({ questions: [q("a", 0), q("b", 1), q("c", 2), q("d", 3)] }).balanced).toBe(true);
    expect(keyBalance({ questions: [q("a", 0), q("b", 0), q("c", 0), q("d", 0)] }).balanced).toBe(false);
  });
  it("encontra questões parecidas demais", () => {
    expect(similarity(good.stem, good.stem)).toBe(1);
    expect(findDuplicates([{ slug: "a", stem: good.stem }, { slug: "b", stem: good.stem }])).toHaveLength(1);
    expect(findDuplicates([{ slug: "a", stem: good.stem }, { slug: "b", stem: "Criança de dois anos com febre alta e exantema súbito em tronco e membros, sem outras queixas. Qual o agente?" }])).toHaveLength(0);
  });
  it("aponta fonte não cadastrada e slug repetido", () => {
    const lot: Lot = { id: "x", sources: [], questions: [q("a", 0), q("a", 1)] };
    const result = lintLot(lot);
    expect(result.fatalCount).toBeGreaterThan(0);
    expect(result.duplicateSlugs).toEqual(["a"]);
    expect(lintLot({ ...lot, sources: [source], questions: [q("a", 0)] }).fatalCount).toBe(0);
  });
});
