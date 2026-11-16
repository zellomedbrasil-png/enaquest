import { describe, expect, it } from "vitest";
import { assemble } from "./assemble-official";
import type { Source } from "../pipeline/schema";

const catalog: Source[] = [{ id: "ms-teste", title: "Manual de teste", publisher: "MS", year: 2024, url: "https://example.org/manual", checked_on: "2026-11-16" }];

// Texto fictício: o teste só olha a estrutura, não reproduz prova real.
const transcription = [
  { n: 1, stem: "Enunciado fictício número um da prova de teste, com pergunta no final?", options: ["Primeira", "Segunda", "Terceira", "Quarta"] },
  { n: 2, stem: "Enunciado fictício número dois da prova de teste, com pergunta no final?", options: ["Primeira", "Segunda", "Terceira", "Quarta"] },
  { n: 3, stem: "Enunciado fictício número três da prova de teste, com pergunta no final?", options: ["Primeira", "Segunda", "Terceira", "Quarta"] },
];
const keys = { "1": "B", "2": "ANULADA", "3": "A" };

const comment = (extra: Record<string, unknown> = {}) => ({
  area_id: "clinica",
  competency_id: "decisao",
  theme: "Tema de teste",
  scenario: "UBS",
  difficulty: "medio",
  quick: "A segunda alternativa é a correta porque o caso pede essa conduta.",
  reasoning: "Primeiro reconhecemos o quadro, depois comparamos as alternativas e escolhemos a conduta indicada.",
  distractors: [
    { index: 0, why: "A primeira alternativa não se aplica a este quadro clínico." },
    { index: 2, why: "A terceira alternativa trata outra condição que não é a do caso." },
    { index: 3, why: "A quarta alternativa seria excessiva para o cenário descrito." },
  ],
  tip: "Leia o cenário antes das alternativas.",
  pearl: "Não escolha pela alternativa mais completa.",
  competency_note: "Escolher a conduta adequada no cenário.",
  claims: [{ claim: "Critério de teste.", source_id: "ms-teste", locator: "Cap. 1" }],
  key_why: "O caso descrito pede exatamente a conduta da segunda alternativa, pelos dados do enunciado.",
  theory: { title: "Tema de teste", intro: "Introdução de teste com tamanho suficiente para passar.", sections: [{ heading: "Seção de teste", items: ["Item de teste"] }] },
  summary: {
    title: "Resumo de teste",
    points: [
      { label: "Um", text: "Ponto um" },
      { label: "Dois", text: "Ponto dois" },
      { label: "Três", text: "Ponto três" },
    ],
  },
  ...extra,
});

const cfg = {
  exam: { id: "teste-2025", track_id: "enamed", board: "Inep", name: "Prova de teste 2025", year: 2025, key_status: "definitivo" as const, origin: "oficial_inep" as const, license: "pendente" as const },
  slug_prefix: "teste-2025",
  transcription: "",
  key: "",
  figures_dir: "",
  media_prefix: "teste-2025",
  output: "",
};

const run = (comments: Record<number, unknown>, extra: Partial<Parameters<typeof assemble>[0]> = {}) =>
  assemble({ cfg, transcription, keys, catalog, readComment: (n) => comments[n] ?? null, checkSources: false, today: "2026-11-16", ...extra });

describe("montador de prova oficial", () => {
  it("monta as questões comentadas e lista as pendentes", async () => {
    const { lot, report } = await run({ 1: comment() });
    expect(lot.questions.map((q) => q.official?.number)).toEqual([1]);
    expect(report.pending).toEqual([2, 3]);
    expect(lot.questions[0].correct_index).toBe(1);
    expect(lot.questions[0].slug).toBe("teste-2025-q01");
    // O gabarito oficial não aparece entre as explicações das erradas.
    expect(lot.questions[0].distractors.map((d) => d.index)).toEqual([0, 2, 3]);
  });

  it("trata a anulada sem gabarito válido e sem key_why", async () => {
    const annulled = comment({
      key_why: undefined,
      distractors: [0, 1, 2, 3].map((index) => ({ index, why: "Comentário da alternativa na questão anulada, sem apontar certa." })),
    });
    const { lot, report } = await run({ 2: annulled });
    const q = lot.questions[0];
    expect(q.official).toMatchObject({ number: 2, annulled: true });
    expect(q.official?.annulled_note).toContain("Anulada");
    expect(q.key_why).toBeUndefined();
    expect(report.lint.fatalCount).toBe(0);
  });

  it("recusa comentário malformado e fonte desconhecida, sem derrubar o lote", async () => {
    const { lot, report } = await run({
      1: comment({ quick: undefined }),
      3: comment({ claims: [{ claim: "x", source_id: "fonte-que-nao-existe", locator: "y" }] }),
    });
    expect(lot.questions).toHaveLength(0);
    expect(report.invalid.map((i) => i.n)).toEqual([1, 3]);
  });

  it("marca como prioridade a questão com dúvida sobre o gabarito", async () => {
    const { lot, report } = await run({ 1: comment({ review_note: "Duas alternativas defensáveis." }), 3: comment() });
    expect(lot.questions.find((q) => q.official?.number === 1)?.risk_level).toBe("alto");
    expect(lot.questions.find((q) => q.official?.number === 3)?.risk_level).toBe("normal");
    expect(Object.keys(report.priority)).toEqual(["1"]);
  });

  it("conferindo fontes, recusa a que não responde", async () => {
    const bad = comment({ new_sources: [{ id: "fonte-nova", title: "Documento", publisher: "X", year: 2024, url: "https://doi.org/10.9999/nao-existe-xyz" }], claims: [{ claim: "x", source_id: "fonte-nova", locator: "y" }] });
    const { report } = await run({ 1: bad }, { checkSources: true });
    expect(report.dropped_sources).toHaveLength(1);
    expect(report.invalid.map((i) => i.n)).toContain(1);
  });
});
