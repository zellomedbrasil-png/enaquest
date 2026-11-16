import { describe, expect, it } from "vitest";
import { findDuplicates, keyBalance, lintDraft, lintLot, similarity } from "./lint";
import type { Draft, Lot, LotQuestion, StudyExtras } from "./schema";

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

describe("material de estudo extra", () => {
  const extras: StudyExtras = {
    key_why: "Tosse há mais de três semanas com lesão cavitária pede confirmação bacteriológica, e o teste rápido molecular é o exame inicial previsto no protocolo.",
    theory: {
      title: "Diagnóstico de tuberculose pulmonar",
      intro: "A tuberculose pulmonar é suspeitada em quem tem tosse persistente, e a confirmação começa na própria UBS.",
      sections: [
        { heading: "Quando investigar", items: ["Tosse por três semanas ou mais na população geral."] },
        { heading: "Primeiro exame", body: "O teste rápido molecular no escarro é o exame inicial quando disponível." },
      ],
    },
    summary: {
      title: "Resumo: tuberculose na UBS",
      points: [
        { label: "Suspeita", text: "Tosse por três semanas ou mais." },
        { label: "Exame", text: "Teste rápido molecular no escarro." },
        { label: "Armadilha", text: "Baciloscopia negativa não exclui." },
      ],
    },
  };
  const codesWith = (extra: Partial<StudyExtras>) => lintDraft({ ...good, ...extra }).filter((i) => i.fatal).map((i) => i.code);

  it("aceita questão sem os extras e com extras bem formados", () => {
    expect(codesWith({})).toEqual([]);
    expect(codesWith(extras)).toEqual([]);
  });
  it("rejeita comentário da correta raso", () => {
    expect(codesWith({ key_why: "Porque sim." })).toContain("key_why_thin");
  });
  it("rejeita revisão do tema sem seções", () => {
    expect(codesWith({ theory: { ...extras.theory, sections: [] } })).toContain("theory_shape");
  });
  it("rejeita resumo com poucos pontos", () => {
    expect(codesWith({ summary: { ...extras.summary, points: extras.summary.points.slice(0, 2) } })).toContain("summary_shape");
  });
  it("rejeita marcação de markdown", () => {
    expect(codesWith({ summary: { ...extras.summary, title: "**Resumo** do tema" } })).toContain("markdown");
    expect(codesWith({ theory: { ...extras.theory, intro: "- Primeiro ponto da revisão do tema, escrito como lista." } })).toContain("markdown");
  });
});

describe("prova oficial", () => {
  // Texto fictício: o lint só olha a estrutura, não reproduz prova real.
  const official: LotQuestion = {
    ...good,
    stem: "Enunciado fictício no formato da banca, sem ponto de interrogação no fim",
    options: ["Primeira", "Segunda", "Terceira", "Quarta", "Todas as anteriores"],
    distractors: [...good.distractors, { index: 4, why: "Comentário da quinta alternativa da banca." }],
    slug: "enamed-2025-c1-q1",
    area_id: "clinica",
    competency_id: "decisao",
    theme: "Tema",
    scenario: "UBS",
    difficulty: "medio",
    risk_level: "normal",
    expires_on: "2027-12-31",
    official: { number: 1, annulled: false },
  };
  const lot = (questions: LotQuestion[]): Lot => ({
    id: "enamed-2025-c1",
    sources: [{ id: "ms-tb", title: "Manual", publisher: "MS", year: 2024, url: "https://example.org", checked_on: "2026-11-16" }],
    official_exam: {
      id: "enamed-2025-c1",
      track_id: "enamed",
      board: "Inep",
      name: "ENAMED 2025",
      year: 2025,
      key_status: "definitivo",
      origin: "oficial_inep",
      license: "pendente",
    },
    questions,
  });
  const fatalCodes = (l: Lot) => lintLot(l).report.flatMap((r) => r.issues.filter((i) => i.fatal).map((i) => i.code));

  it("aceita o texto da banca como veio, com 5 alternativas", () => {
    expect(fatalCodes(lot([official]))).toEqual([]);
  });
  it("continua exigindo comentário e fonte", () => {
    expect(fatalCodes(lot([{ ...official, claims: [] }]))).toContain("no_claims");
    expect(fatalCodes(lot([{ ...official, distractors: good.distractors }]))).toContain("distractor_missing");
  });
  it("exige o número da questão e não aceita número repetido", () => {
    expect(fatalCodes(lot([{ ...official, official: undefined }]))).toContain("official_missing");
    expect(fatalCodes(lot([official, { ...official, slug: "outra" }]))).toContain("official_number_repeated");
  });
  it("anulada precisa do motivo e dispensa o comentário por alternativa", () => {
    const annulled = { ...official, distractors: [], official: { number: 1, annulled: true } };
    expect(fatalCodes(lot([annulled]))).toEqual(["annulled_no_note"]);
    expect(fatalCodes(lot([{ ...annulled, official: { number: 1, annulled: true, annulled_note: "Duas alternativas corretas." } }]))).toEqual([]);
  });
  it("lote autoral não aceita número oficial", () => {
    const authored: Lot = { ...lot([official]), official_exam: undefined };
    expect(fatalCodes(authored)).toContain("official_without_exam");
  });
});
