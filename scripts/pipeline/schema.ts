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

/** Questão pronta para entrar em um lote. */
export const LotQuestionSchema = DraftSchema.extend({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  area_id: z.enum(AREA_IDS),
  competency_id: z.enum(COMPETENCY_IDS),
  theme: z.string().min(3),
  scenario: z.string().min(2),
  difficulty: z.enum(DIFFICULTIES),
  risk_level: z.enum(["normal", "alto"]),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
