import { z } from "zod";

export const AREA_IDS = ["clinica", "pediatria", "go", "cirurgia", "mental", "coletiva", "mfc"] as const;
export const COMPETENCY_IDS = ["hipotese", "propedeutica", "terapeutica", "urgencia", "decisao", "sus", "etica"] as const;
export const DIFFICULTIES = ["facil", "medio", "dificil", "muito_dificil"] as const;

/** O que o modelo escreve. Vale também para questões escritas à mão. */
export const DraftSchema = z.object({
  stem: z.string().describe("Caso clínico curto, de 5 a 12 linhas, terminando em uma única pergunta."),
  exams: z
    .array(z.object({ title: z.string(), rows: z.array(z.array(z.string())) }))
    .nullable()
    .describe("Tabelas de exames, cada linha com [exame, resultado, referência]. Null se não houver."),
  options: z.array(z.string()).describe("Exatamente 4 alternativas, sem a letra no início."),
  correct_index: z.number().describe("Índice da alternativa correta, de 0 a 3."),
  quick: z.string().describe("A resposta e o motivo central em até 40 palavras."),
  reasoning: z.string().describe("Raciocínio clínico passo a passo, do caso até a conduta."),
  distractors: z
    .array(z.object({ index: z.number(), why: z.string() }))
    .describe("Uma entrada para cada alternativa errada, explicando o erro."),
  tip: z.string().describe("Macete de prova, em até 30 palavras."),
  pearl: z.string().describe("Armadilha clássica sobre o tema, em até 40 palavras."),
  competency_note: z.string().describe("O que a prova quer avaliar nessa questão, em até 30 palavras."),
  claims: z
    .array(z.object({ claim: z.string(), source_id: z.string(), locator: z.string() }))
    .describe("Cada dose, número, critério ou recomendação usada, com a fonte que o sustenta."),
});
export type Draft = z.infer<typeof DraftSchema>;

/**
 * Material de estudo extra. Sem limites de tamanho aqui (a saída estruturada não aceita todos);
 * o lint confere o formato final com os limites de src/lib/study/content.ts.
 */
export const StudyExtrasSchema = z.object({
  key_why: z.string().describe("Por que a alternativa correta é a correta, em 30 a 70 palavras, ligando os dados do caso à conduta."),
  theory: z
    .object({
      title: z.string().describe("Título do tema, curto."),
      intro: z.string().describe("Abertura de 2 a 3 frases situando o tema."),
      sections: z
        .array(
          z.object({
            heading: z.string(),
            body: z.string().optional(),
            items: z.array(z.string()).optional().describe("Até 6 itens curtos."),
          }),
        )
        .describe("De 2 a 4 seções: quando suspeitar ou indicar, como conduzir, critérios e doses que a fonte sustenta."),
      alert: z.string().optional().describe("Um alerta de segurança ou de prova, se houver."),
    })
    .describe("Revisão do tema da questão, para quem nunca estudou o assunto. Até 350 palavras no total."),
  summary: z
    .object({
      title: z.string(),
      points: z
        .array(z.object({ label: z.string().describe("Rótulo curto, como Conceito, Indicação, Conduta."), text: z.string(), sub: z.array(z.string()).optional() }))
        .describe("De 4 a 7 pontos para revisar em 30 segundos."),
    })
    .describe("Resumo do tema em tópicos."),
});
export type StudyExtras = z.infer<typeof StudyExtrasSchema>;

/** O que o modelo escreve em lotes novos: questão completa com o material de estudo. */
export const AuthorDraftSchema = DraftSchema.extend(StudyExtrasSchema.shape);

/** Figura do enunciado: caminho no bucket question-media ou URL completa. */
export const QuestionImageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(10).describe("Descrição da figura para leitor de tela, sem entregar o diagnóstico."),
  caption: z.string().optional(),
});

/**
 * Questão de prova oficial. O enunciado e as alternativas são os da banca, sem reescrita.
 * Em questão anulada, correct_index é ignorado na importação: a banca não deixou gabarito válido.
 */
export const OfficialRefSchema = z.object({
  number: z.number().int().positive(),
  annulled: z.boolean().default(false),
  annulled_note: z.string().optional(),
  outdated_note: z.string().optional(),
});

/** Prova oficial de onde vêm as questões de um lote. */
export const OfficialExamSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  track_id: z.string().default("enamed"),
  board: z.string(),
  name: z.string(),
  year: z.number().int().min(2000).max(2100),
  booklet: z.string().optional(),
  applied_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  key_status: z.enum(["preliminar", "definitivo"]),
  origin: z.enum(["oficial_inep", "oficial_ebserh"]),
  /** Só "liberado" entra nas rodadas. "pendente" importa, mas não aparece para o aluno. */
  license: z.enum(["pendente", "liberado", "bloqueado"]),
  booklet_url: z.url().optional(),
  key_url: z.url().optional(),
});
export type OfficialExam = z.infer<typeof OfficialExamSchema>;

/** Questão pronta para entrar em um lote. Os extras são opcionais para os lotes antigos continuarem válidos. */
export const LotQuestionSchema = DraftSchema.extend(StudyExtrasSchema.partial().shape).extend({
  images: z.array(QuestionImageSchema).optional(),
  official: OfficialRefSchema.optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  area_id: z.enum(AREA_IDS),
  competency_id: z.enum(COMPETENCY_IDS),
  theme: z.string().min(3),
  scenario: z.string().min(2),
  difficulty: z.enum(DIFFICULTIES),
  risk_level: z.enum(["normal", "alto"]),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Preenchido pelas checagens quando há dúvida: a questão é importada, mas fica fora do ar. */
  hold_reason: z.string().optional(),
});
export type LotQuestion = z.infer<typeof LotQuestionSchema>;

export const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  year: z.number().int(),
  url: z.url(),
  checked_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type Source = z.infer<typeof SourceSchema>;

export const LotSchema = z.object({
  id: z.string(),
  notes: z.string().optional(),
  official_exam: OfficialExamSchema.optional(),
  sources: z.array(SourceSchema),
  questions: z.array(LotQuestionSchema).min(1),
});
export type Lot = z.infer<typeof LotSchema>;

export const BlueprintItemSchema = z.object({
  slug: z.string(),
  area_id: z.enum(AREA_IDS),
  competency_id: z.enum(COMPETENCY_IDS),
  theme: z.string(),
  scenario: z.string(),
  difficulty: z.enum(DIFFICULTIES),
  risk_level: z.enum(["normal", "alto"]),
  source_ids: z.array(z.string()).min(1),
});
export type BlueprintItem = z.infer<typeof BlueprintItemSchema>;

export const BlindAnswerSchema = z.object({
  answer_index: z.number(),
  confident: z.boolean(),
  other_defensible: z.array(z.number()).describe("Outras alternativas que também poderiam ser defendidas."),
  stem_problem: z.string().nullable().describe("Problema no enunciado que impede responder com segurança, ou null."),
});

/** Revisão de lote já escrito, sem o texto das fontes: o verificador usa o que sabe das diretrizes. */
export const SafetyReviewSchema = z.object({
  key_is_correct: z.boolean(),
  dangerous_content: z.string().nullable().describe("Conteúdo que pode causar dano se um médico o seguisse, ou null."),
  problems: z
    .array(z.string())
    .describe("Dose, número, critério ou recomendação que parece errado ou desatualizado nas diretrizes brasileiras vigentes. Vazio se nada."),
});

export const FactCheckSchema = z.object({
  verdicts: z.array(
    z.object({
      claim: z.string(),
      supported: z.boolean(),
      note: z.string(),
    }),
  ),
  key_is_correct: z.boolean(),
  dangerous_content: z.string().nullable(),
});
