// Radar do edital: datas e mudanças do Enamed e do Enare, cada uma com a fonte e a data da conferência.
// Regra da casa: nada entra sem fonte. A confiança diz de onde veio: oficial (Inep, MEC, HU Brasil, edital),
// secundária (portal ou cursinho que repete o edital) ou a confirmar. Atualize `CHECKED_ON` ao conferir de novo.

export const CHECKED_ON = "2026-11-16";

export type Confidence = "oficial" | "secundaria" | "confirmar";
export type RadarSource = { title: string; url: string };

export type RadarEvent = {
  id: string;
  topic: "enamed" | "enare";
  title: string;
  /** Data do evento (AAAA-MM-DD). Para períodos, o último dia, pois é ele que define se já passou. */
  date: string;
  /** Texto da data como no edital, por exemplo "15 a 17/09/2026". */
  dateLabel: string;
  detail: string;
  confidence: Confidence;
  source: RadarSource;
};

export type RadarChange = {
  id: string;
  topic: "enamed" | "enare";
  title: string;
  detail: string;
  confidence: Confidence;
  source: RadarSource;
};

const EDITAL_ENAMED: RadarSource = {
  title: "Edital Inep nº 71/2026, Enamed 2026 (DOU de 21/08/2026; cópia publicada pela ABMES)",
  url: "https://abmes.org.br/arquivos/legislacoes/Edital-inep-071-2026-05-28-Republicado.pdf",
};
const INEP_NOTICIA: RadarSource = {
  title: "Inep: gabarito preliminar do Enamed 2026 e da 1ª etapa do Revalida 2026/2 (15/09/2026)",
  url: "https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/enamed/inep-divulga-gabarito-preliminar-do-enamed-2026-e-da-1a-etapa-do-revalida-2026-2",
};
const INEP_PAGINA: RadarSource = {
  title: "Inep: página do Enamed",
  url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed",
};
const MEC_ENARE: RadarSource = {
  title: "MEC: editais do Enare 2026/2027 com novas regras",
  url: "https://www.gov.br/mec/pt-br/assuntos/noticias/2026/junho/publicados-editais-do-enare-2026-2027-com-novas-regras",
};
const HU_PRORROGACAO: RadarSource = {
  title: "HU Brasil: Enare prorroga a inscrição até 5 de julho para as especialidades de acesso direto",
  url: "https://www.gov.br/hubrasil/pt-br/comunicacao/noticias/enare-prorroga-prazo-de-inscricao-ate-5-de-julho-para-especialidades-medicas-de-acesso-direto",
};
const MEDWAY_ENARE: RadarSource = {
  title: "Medway: edital Enare 2026/2027 (portal privado; confira no edital 02/2026)",
  url: "https://www.medway.com.br/conteudos/residencia-medica-enare/",
};

export const EVENTS: RadarEvent[] = [
  {
    id: "enamed-inscricao",
    topic: "enamed",
    title: "Inscrições do Enamed 2026",
    date: "2026-07-01",
    dateLabel: "15/06 a 01/07/2026",
    detail: "Pelo Sistema Enamed. Quem quer usar a nota no Enare completa a inscrição no Sistema Enare.",
    confidence: "oficial",
    source: EDITAL_ENAMED,
  },
  {
    id: "enare-inscricao",
    topic: "enare",
    title: "Inscrições do Enare 2026/2027, acesso direto",
    date: "2026-07-05",
    dateLabel: "15/06 a 05/07/2026 (prorrogadas)",
    detail: "O prazo inicial ia até 29/06 e foi prorrogado até 5 de julho. A taxa podia ser paga até 6 de julho.",
    confidence: "oficial",
    source: HU_PRORROGACAO,
  },
  {
    id: "enamed-prova",
    topic: "enamed",
    title: "Prova do Enamed 2026",
    date: "2026-09-13",
    dateLabel: "13/09/2026, das 13h30 às 18h30",
    detail: "100 questões de múltipla escolha, com 4 alternativas e uma correta, em 5 horas. Portões abrem às 12h e fecham às 13h.",
    confidence: "oficial",
    source: EDITAL_ENAMED,
  },
  {
    id: "enamed-gabarito-preliminar",
    topic: "enamed",
    title: "Gabarito preliminar do Enamed 2026 e prazo de recurso",
    date: "2026-09-17",
    dateLabel: "Gabarito em 15/09; recursos de 15 a 17/09/2026",
    detail: "Os recursos foram feitos pelo Sistema Enamed.",
    confidence: "oficial",
    source: INEP_NOTICIA,
  },
  {
    id: "enamed-reaplicacao",
    topic: "enamed",
    title: "Reaplicação do Enamed 2026",
    date: "2026-10-18",
    dateLabel: "18/10/2026",
    detail: "Só para quem teve problema logístico comprovado ou doença infectocontagiosa listada no edital. O pedido era de 14 a 15/09 e a reaplicação ocorre uma única vez.",
    confidence: "oficial",
    source: EDITAL_ENAMED,
  },
  {
    id: "enamed-resultado",
    topic: "enamed",
    title: "Gabarito definitivo e resultados do Enamed 2026",
    date: "2026-12-04",
    dateLabel: "04/12/2026",
    detail: "Nesta data saem o resultado dos recursos do gabarito preliminar, a versão definitiva do gabarito e os resultados de concluintes, demais participantes e estudantes do quarto ano.",
    confidence: "oficial",
    source: EDITAL_ENAMED,
  },
  {
    id: "enare-nota-final",
    topic: "enare",
    title: "Resultado da nota final no Enare, acesso direto",
    date: "2027-01-08",
    dateLabel: "Preliminar em 18/12/2026; definitivo em 08/01/2027",
    detail: "Datas divulgadas por portais com base no edital. Não consegui abrir o anexo do cronograma do edital 02/2026 para conferir; confira lá antes de planejar.",
    confidence: "secundaria",
    source: MEDWAY_ENARE,
  },
  {
    id: "enare-escolha-vagas",
    topic: "enare",
    title: "Escolha de vagas e pré-matrícula, acesso direto",
    date: "2027-02-01",
    dateLabel: "Escolha a partir de 11/01/2027; pré-matrícula a partir de 01/02/2027",
    detail: "Mesma ressalva: datas de portais, a confirmar no edital 02/2026 e no site do Enare.",
    confidence: "secundaria",
    source: MEDWAY_ENARE,
  },
];

export const CHANGES: RadarChange[] = [
  {
    id: "mudanca-enamed-semestral",
    topic: "enamed",
    title: "O Enamed passa a ser semestral",
    detail:
      "A Medida Provisória nº 1.370, de 19/06/2026, adequou o Enamed ao regime semestral. A página do Inep informa que o exame será realizado semestralmente a partir de 2027, o que abre mais de uma chance por ano.",
    confidence: "oficial",
    source: INEP_PAGINA,
  },
  {
    id: "mudanca-nota-tri",
    topic: "enamed",
    title: "Nota por TRI, válida por 3 anos",
    detail:
      "A nota do Enamed pela escala de proficiência (Teoria de Resposta ao Item) vale por 3 anos. Quem já tem nota válida escolhe, na inscrição, fazer a prova de novo ou só reaproveitar a nota, e no reaproveitamento o Enare usa a maior nota obtida.",
    confidence: "oficial",
    source: EDITAL_ENAMED,
  },
  {
    id: "mudanca-enamed-e-a-prova-do-enare",
    topic: "enare",
    title: "O Enamed é a prova objetiva do acesso direto do Enare",
    detail:
      "Para as especialidades de acesso direto, a nota do Enamed é a nota da prova. Quem não é concluinte inscrito pelo curso (os demais participantes) também pode fazer o Enamed só para usar a nota. Estudantes do quarto ano fazem o Enamed, mas não podem usar a nota no Enare.",
    confidence: "oficial",
    source: EDITAL_ENAMED,
  },
  {
    id: "mudanca-marco-conteudo",
    topic: "enamed",
    title: "Atualização do conteúdo da prova: até 3 de julho de 2026",
    detail:
      "O edital limita o marco de atualização normativa e bibliográfica da prova de 2026 a 3 de julho de 2026. Diretrizes e protocolos publicados depois dessa data não entram nessa edição. A prova usa a Matriz de Referência Comum para a Avaliação da Formação Médica (Portaria Inep nº 478/2025).",
    confidence: "oficial",
    source: EDITAL_ENAMED,
  },
  {
    id: "mudanca-cnrm",
    topic: "enare",
    title: "Resolução CNRM nº 4/2026: TRI e resultados do Enare em outras residências",
    detail:
      "A prova poderá usar métodos baseados em escala de proficiência, como a TRI. Os processos de especialidades com pré-requisito, área de atuação ou anos adicionais poderão usar os resultados do Enare como etapa de conhecimentos teóricos.",
    confidence: "oficial",
    source: MEC_ENARE,
  },
  {
    id: "mudanca-hu-brasil",
    topic: "enare",
    title: "A Ebserh agora se chama HU Brasil",
    detail: "O edital do Enare 2026/2027 para residência médica de acesso direto é publicado pela HU Brasil, antiga Ebserh.",
    confidence: "oficial",
    source: EDITAL_ENAMED,
  },
];

export type EventStatus = "passou" | "proximo" | "futuro";

/** Dias entre duas datas AAAA-MM-DD (positivo se `to` é depois de `from`). */
export function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  return Math.round((t - f) / 86_400_000);
}

/** Marca cada evento como já ocorrido, o próximo ou futuro. O próximo é o primeiro que ainda não passou. */
export function classify(events: RadarEvent[], today: string): (RadarEvent & { status: EventStatus; daysLeft: number })[] {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  let nextMarked = false;
  return sorted.map((event) => {
    const daysLeft = daysBetween(today, event.date);
    if (daysLeft < 0) return { ...event, status: "passou", daysLeft };
    if (!nextMarked) {
      nextMarked = true;
      return { ...event, status: "proximo", daysLeft };
    }
    return { ...event, status: "futuro", daysLeft };
  });
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  oficial: "Fonte oficial",
  secundaria: "Portal, a confirmar no edital",
  confirmar: "A confirmar",
};
