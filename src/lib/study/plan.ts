// Plano de estudo até a prova. Função pura: roda no navegador, sem conta e sem banco.
// As premissas de ritmo são sugestões de estudo, não regra da prova; a página as mostra ao aluno.

export type PlanArea = { id: string; name: string; color: string; share: number };

export type PlanInput = {
  today: string; // AAAA-MM-DD
  examDate: string; // AAAA-MM-DD
  hoursPerWeek: number;
  weakAreas: string[];
  areas: PlanArea[];
};

export type PlanPhase = { key: "base" | "consolidacao" | "reta"; title: string; weeks: number; focus: string };

export type StudyPlan = {
  days: number;
  weeks: number;
  hoursPerWeek: number;
  questionsPerWeek: number;
  totalQuestions: number;
  simulados: number;
  phases: PlanPhase[];
  areas: { id: string; name: string; color: string; hours: number; questions: number; weak: boolean; pct: number }[];
};

/** Metade do tempo resolvendo questões, a 15 por hora contando a leitura do comentário. */
export const QUESTIONS_PER_HOUR = 15;
export const QUESTION_TIME_SHARE = 0.5;
/** Área marcada como difícil ganha 50% a mais de peso. */
export const WEAK_BOOST = 1.5;

const DAY = 86_400_000;

function parseDay(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Arredonda para a meia hora mais próxima, sem zerar uma área. */
function halfHours(value: number): number {
  return Math.max(0.5, Math.round(value * 2) / 2);
}

export function buildPlan(input: PlanInput): StudyPlan | null {
  const days = Math.round((parseDay(input.examDate) - parseDay(input.today)) / DAY);
  if (!Number.isFinite(days) || days < 7) return null;
  const hoursPerWeek = Math.min(Math.max(Math.round(input.hoursPerWeek), 2), 70);
  const weeks = Math.floor(days / 7);

  // Fases: base, consolidação e reta final. A reta final tem ao menos 2 semanas quando o prazo permite.
  // Menos de 6 semanas: não há tempo para base, só consolidação e reta final.
  const reta = weeks >= 6 ? Math.max(2, Math.round(weeks * 0.15)) : Math.min(weeks, 2);
  const consolidacao = weeks >= 6 ? Math.max(1, Math.round(weeks * 0.25)) : weeks - reta;
  const base = Math.max(0, weeks - reta - consolidacao);
  const phases: PlanPhase[] = [
    { key: "base" as const, title: "Base", weeks: base, focus: "Teoria das áreas de maior peso e questões comentadas todo dia." },
    { key: "consolidacao" as const, title: "Consolidação", weeks: consolidacao, focus: "Mais questões que teoria. Revisão dos erros e das áreas marcadas como difíceis." },
    { key: "reta" as const, title: "Reta final", weeks: reta, focus: "Simulados com tempo de prova, revisão dos erros e nada de conteúdo novo." },
  ].filter((phase) => phase.weeks > 0);

  const weak = new Set(input.weakAreas);
  const weights = input.areas.map((area) => area.share * (weak.has(area.id) ? WEAK_BOOST : 1));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
  const questionsPerWeek = Math.round(hoursPerWeek * QUESTION_TIME_SHARE * QUESTIONS_PER_HOUR);

  const areas = input.areas
    .map((area, i) => {
      const fraction = weights[i] / totalWeight;
      return {
        id: area.id,
        name: area.name,
        color: area.color,
        hours: halfHours(hoursPerWeek * fraction),
        questions: Math.max(1, Math.round(questionsPerWeek * fraction)),
        weak: weak.has(area.id),
        pct: Math.round(fraction * 100),
      };
    })
    .sort((a, b) => b.pct - a.pct);

  // Um simulado a cada duas semanas na consolidação e um por semana na reta final.
  const simulados = Math.floor(consolidacao / 2) + reta;

  return {
    days,
    weeks,
    hoursPerWeek,
    questionsPerWeek,
    totalQuestions: questionsPerWeek * weeks,
    simulados,
    phases,
    areas,
  };
}
