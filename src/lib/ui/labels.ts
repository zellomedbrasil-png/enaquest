// Textos compartilhados pela interface.

export const LETTERS = ["A", "B", "C", "D", "E"];

/** Em questão de prova oficial, a questão é da banca; o selo fala só do comentário. */
export const OFFICIAL_SEALS: Record<string, { label: string; detail: string }> = {
  ia_verificada: {
    label: "Comentário verificado por IA",
    detail: "Questão da prova oficial, com o gabarito da banca. O comentário foi escrito e checado por modelos de IA, com fontes; nenhum médico o leu individualmente.",
  },
  lote_amostrado: {
    label: "Comentário aprovado por amostragem",
    detail: "Questão da prova oficial, com o gabarito da banca. Um médico revisou uma amostra dos comentários desta prova, sem erro crítico.",
  },
  medico_revisado: {
    label: "Comentário revisado por médico",
    detail: "Questão da prova oficial, com o gabarito da banca. Um médico leu e aprovou este comentário.",
  },
};

export const SEALS: Record<string, { label: string; detail: string }> = {
  ia_verificada: {
    label: "Verificada por IA",
    detail: "Criada e checada por modelos de IA, com fontes. Nenhum médico leu esta questão individualmente.",
  },
  lote_amostrado: {
    label: "Lote aprovado por amostragem",
    detail: "Um médico revisou uma amostra sorteada do lote, sem erro crítico. Esta questão pode não ter sido lida individualmente.",
  },
  medico_revisado: {
    label: "Revisada por médico",
    detail: "Um médico leu e aprovou esta questão.",
  },
};

export const ERROR_REASON_LABEL: Record<string, string> = {
  conteudo: "Não sabia o conteúdo",
  leitura: "Li errado",
  pressa: "Fui na pressa",
  chute: "Chutei",
  entre_duas: "Fiquei entre duas",
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  certeza: "Tenho certeza",
  duvida: "Estou em dúvida",
  chute: "Vou chutar",
};

export const REPORT_LABEL: Record<string, string> = {
  gabarito: "O gabarito parece errado",
  desatualizada: "Está desatualizada",
  enunciado: "O enunciado tem problema",
  comentario: "O comentário tem erro",
  outro: "Outro problema",
};

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
