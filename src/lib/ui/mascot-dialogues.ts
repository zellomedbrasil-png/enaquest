// Falas do mascote dentro do card da questão (Posto de Plantão).
// Para acrescentar uma frase, basta incluir mais um item no array do estado.
// Marcadores aceitos: {option} (letra escolhida) e {xp} (XP ganho).

import type { Confidence } from "@/lib/study/srs";

export type MascotStationState =
  | "IDLE_START"
  | "OPTION_SELECTED"
  | "OPTION_ELIMINATED"
  | "CONFIDENCE_SELECTED"
  | "THINKING_TIMEOUT"
  | "HINT_REQUESTED"
  | "ANSWERED_CORRECT"
  | "ANSWERED_WRONG";

export type MascotTone = "neutral" | "info" | "hint" | "success" | "warning";

export const MASCOT_DIALOGUES: Record<Exclude<MascotStationState, "CONFIDENCE_SELECTED" | "HINT_REQUESTED">, string[]> = {
  IDLE_START: [
    "Prontuário novo na mão! Analise os dados do caso e marque a conduta.",
    "Caso na tela! Leia com atenção os dados vitais antes de olhar as alternativas.",
    "Paciente chegando. Primeiro a pergunta final, depois os detalhes do enunciado.",
  ],
  OPTION_SELECTED: [
    "Alternativa {option} selecionada. Marca sua confiança ali e confirma!",
    "Boa! Já tem uma hipótese na letra {option}. Tem certeza ou vai na dúvida?",
  ],
  OPTION_ELIMINATED: [
    "Boa estratégia! Descartar as absurdas aumenta muito sua chance no ENARE.",
    "Menos uma distratora no caminho. Foco nas que sobraram!",
  ],
  THINKING_TIMEOUT: [
    "Questão capciosa? Vai direto na pergunta final do enunciado e procura as palavras-chave!",
    "Travou? Releia só a última frase do enunciado: ela diz exatamente o que a banca quer.",
  ],
  ANSWERED_CORRECT: [
    "Conduta perfeita, Doutor(a)! Mais um passo firme rumo à aprovação no ENARE.",
    "Na mosca! Guarda a pista que te levou até aí, ela volta na prova.",
  ],
  ANSWERED_WRONG: [
    "Plantão tem dessas! O importante é entender o detalhe no comentário pra não cair na prova.",
    "Faz parte do treino. Lê o comentário com calma: é aqui que o tema fica blindado.",
  ],
};

export const CONFIDENCE_DIALOGUES: Record<Confidence, string[]> = {
  certeza: ["Segurança de chefe de plantão! Confirma pra gente somar esse XP."],
  duvida: ["Anotado! Mesmo se acertar, vou separar esse tema pra sua Revisão."],
  chute: ["Faz parte do jogo! Vamos ver o gabarito comentado já já pra blindar esse assunto."],
};

/** Texto e cor do selo ao lado do nome, por estado. */
export const MASCOT_BADGES: Record<MascotStationState, { label: string; tone: MascotTone }> = {
  IDLE_START: { label: "Parceiro de Plantão • Ativo", tone: "neutral" },
  OPTION_SELECTED: { label: "Hipótese marcada", tone: "info" },
  OPTION_ELIMINATED: { label: "Descartando distratoras", tone: "info" },
  CONFIDENCE_SELECTED: { label: "Confiança registrada", tone: "info" },
  THINKING_TIMEOUT: { label: "Pensando junto", tone: "hint" },
  HINT_REQUESTED: { label: "Pista clínica", tone: "hint" },
  ANSWERED_CORRECT: { label: "+{xp} XP • Conduta Correta", tone: "success" },
  ANSWERED_WRONG: { label: "Revisar o comentário", tone: "warning" },
};

/** Pistas por grande área. Orientam o raciocínio sem apontar a alternativa. */
const AREA_HINTS: Record<string, string[]> = {
  clinica: [
    "Monte a síndrome antes da doença: junte sintomas, sinais e exames num só quadro.",
    "Procure o dado que muda a conduta: um exame alterado ou um sinal de gravidade.",
  ],
  pediatria: [
    "Idade e peso mudam tudo em Pediatria. Confere se a conduta cabe nessa faixa etária.",
    "Antes de tratar, veja se há sinal de perigo: ele define a urgência da conduta.",
  ],
  go: [
    "Em GO, a idade gestacional é a primeira pista: o mesmo exame muda de interpretação em cada trimestre.",
    "Compare o valor do exame com o ponto de corte do protocolo vigente, não com o da população geral.",
  ],
  cirurgia: [
    "Paciente estável ou instável? Essa resposta já elimina metade das condutas.",
    "Pense na sequência do atendimento: o que vem primeiro antes de qualquer exame ou cirurgia?",
  ],
  mental: [
    "Avalie o risco primeiro: há risco para o paciente ou para terceiros?",
    "Tempo de evolução e prejuízo funcional separam os diagnósticos parecidos.",
  ],
  coletiva: [
    "Releia o que a questão pede: indicador, princípio do SUS ou tipo de estudo? Cada um tem regra própria.",
    "Em Saúde Coletiva, a letra da lei ou da portaria costuma decidir a alternativa.",
  ],
  mfc: [
    "Pense como médico de família: abordagem centrada na pessoa e uso racional de exames.",
    "Coordenação do cuidado: o que se resolve na UBS e o que precisa de encaminhamento?",
  ],
};

const SCENARIO_HINTS: Record<string, string> = {
  UBS: "Lembre do cenário: na UBS, prevalece a conduta de atenção primária com o que está disponível ali.",
  UPA: "Na UPA, o foco é estabilizar e decidir se o paciente fica, recebe alta ou é transferido.",
  SAMU: "No SAMU, pense no atendimento pré-hospitalar: sequência ABCDE e transporte adequado.",
  "Pronto-socorro": "No pronto-socorro, priorize o que ameaça a vida antes de fechar o diagnóstico.",
  Maternidade: "Na maternidade, a conduta precisa considerar mãe e feto ao mesmo tempo.",
};

const GENERIC_HINTS = [
  "Sublinhe mentalmente os números do enunciado: idade, tempo de evolução e valores de exame.",
  "Releia a pergunta final. Ela pede diagnóstico, exame ou conduta? A resposta muda conforme o verbo.",
];

/**
 * Lista de pistas para a questão. A pista própria da questão vem primeiro, quando existir;
 * depois as da área, do cenário e as gerais. Nenhuma revela o gabarito.
 */
export function clinicalHints(args: { clinicalHint?: string | null; areaId?: string; scenario?: string }): string[] {
  const hints: string[] = [];
  if (args.clinicalHint?.trim()) hints.push(args.clinicalHint.trim());
  if (args.areaId && AREA_HINTS[args.areaId]) hints.push(...AREA_HINTS[args.areaId]);
  if (args.scenario && SCENARIO_HINTS[args.scenario]) hints.push(SCENARIO_HINTS[args.scenario]);
  hints.push(...GENERIC_HINTS);
  return hints;
}

/** Troca os marcadores {option} e {xp}. */
export function fillLine(line: string, values: { option?: string; xp?: number }): string {
  return line.replaceAll("{option}", values.option ?? "").replaceAll("{xp}", String(values.xp ?? 0));
}

/**
 * Escolha determinística (sem Math.random) para que servidor e navegador desenhem a mesma
 * frase. A semente muda a cada evento, então as falas se alternam sem repetir em seguida.
 */
export function pickLine(lines: readonly string[], seed: number): string {
  if (!lines.length) return "";
  return lines[((seed % lines.length) + lines.length) % lines.length];
}

export function seedFrom(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash);
}
