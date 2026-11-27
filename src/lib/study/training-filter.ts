// Filtros do Treino: área, tema, prova, dificuldade e situação da questão para a pessoa.
// Função pura: o servidor busca as questões e o histórico, e aqui só se decide o que entra.

export const DIFFICULTIES = ["facil", "medio", "dificil", "muito_dificil"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facil: "Fácil",
  medio: "Média",
  dificil: "Difícil",
  muito_dificil: "Muito difícil",
};

/** Situação da questão para a pessoa. */
export const STATUSES = ["novas", "erradas", "inseguras", "marcadas", "todas"] as const;
export type TrainingStatus = (typeof STATUSES)[number];

/** "todas", só autorais ou uma prova oficial pelo id (ex.: "enamed-2025-c1"). */
export type TrainingSource = "todas" | "autorais" | `prova:${string}`;

export type TrainingFilters = {
  areaId: string | null;
  theme: string | null;
  source: TrainingSource;
  /** Vazio = todas as dificuldades. */
  difficulties: Difficulty[];
  status: TrainingStatus;
  withImages: boolean;
};

export const DEFAULT_FILTERS: TrainingFilters = {
  areaId: null,
  theme: null,
  source: "todas",
  difficulties: [],
  status: "novas",
  withImages: false,
};

export type PoolQuestion = {
  id: string;
  area_id: string;
  theme: string;
  difficulty: Difficulty;
  official_exam_id: string | null;
  has_images: boolean;
};

export type LastAnswer = { correct: boolean; confidence: "certeza" | "duvida" | "chute" | null };

export type TrainingHistory = {
  /** Última resposta de cada questão. */
  last: Map<string, LastAnswer>;
  marked: Set<string>;
};

function matchesStatus(id: string, status: TrainingStatus, history: TrainingHistory): boolean {
  const last = history.last.get(id);
  switch (status) {
    case "novas":
      return !last;
    case "erradas":
      return last?.correct === false;
    case "inseguras":
      // Acertou, mas no chute ou na dúvida: o acerto ainda não é confiável.
      return last?.correct === true && (last.confidence === "duvida" || last.confidence === "chute");
    case "marcadas":
      return history.marked.has(id);
    case "todas":
      return true;
  }
}

export function filterPool(pool: PoolQuestion[], history: TrainingHistory, filters: TrainingFilters): PoolQuestion[] {
  const difficulties = new Set(filters.difficulties);
  const exam = filters.source.startsWith("prova:") ? filters.source.slice("prova:".length) : null;
  return pool.filter((q) => {
    if (filters.areaId && q.area_id !== filters.areaId) return false;
    if (filters.theme && q.theme !== filters.theme) return false;
    if (filters.source === "autorais" && q.official_exam_id !== null) return false;
    if (exam && q.official_exam_id !== exam) return false;
    if (difficulties.size > 0 && !difficulties.has(q.difficulty)) return false;
    if (filters.withImages && !q.has_images) return false;
    return matchesStatus(q.id, filters.status, history);
  });
}

/** Temas de cada área com quantas questões cada um tem, do maior para o menor. */
export function themesByArea(pool: PoolQuestion[]): Record<string, { theme: string; count: number }[]> {
  const counts = new Map<string, Map<string, number>>();
  for (const q of pool) {
    const area = counts.get(q.area_id) ?? new Map<string, number>();
    area.set(q.theme, (area.get(q.theme) ?? 0) + 1);
    counts.set(q.area_id, area);
  }
  return Object.fromEntries(
    [...counts.entries()].map(([area, themes]) => [
      area,
      [...themes.entries()].map(([theme, count]) => ({ theme, count })).sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme, "pt-BR")),
    ]),
  );
}
