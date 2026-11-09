// Termômetro de Proficiência: estimativa de habilidade pelo modelo de Rasch.
// É uma estimativa interna. Só compara com o corte oficial depois de calibrada com boletins reais.

export type Response = { itemRating: number; correct: boolean };

export const MIN_RESPONSES = 50;
export const MIN_AREA_RESPONSES = 10;

const LOGIT_PER_POINT = Math.LN10 / 400;
const CENTER = 1300;
const PRIOR_SD = 1.5;

function toLogit(rating: number) {
  return (rating - CENTER) * LOGIT_PER_POINT;
}
function toRating(logit: number) {
  return logit / LOGIT_PER_POINT + CENTER;
}

/** Estimativa MAP de theta com priori normal, por Newton-Raphson. */
export function estimateTheta(responses: Response[]): { theta: number; se: number } {
  let theta = 0;
  for (let iter = 0; iter < 30; iter++) {
    let gradient = -theta / (PRIOR_SD * PRIOR_SD);
    let information = 1 / (PRIOR_SD * PRIOR_SD);
    for (const r of responses) {
      const p = 1 / (1 + Math.exp(toLogit(r.itemRating) - theta));
      gradient += (r.correct ? 1 : 0) - p;
      information += p * (1 - p);
    }
    const step = gradient / information;
    theta += Math.max(-1, Math.min(1, step));
    if (Math.abs(step) < 1e-5) break;
  }
  let information = 1 / (PRIOR_SD * PRIOR_SD);
  for (const r of responses) {
    const p = 1 / (1 + Math.exp(toLogit(r.itemRating) - theta));
    information += p * (1 - p);
  }
  return { theta, se: Math.sqrt(1 / information) };
}

/** Acerto esperado em uma prova de referência, com dificuldade em torno do nível médio. */
export function expectedPercent(theta: number): number {
  const reference = [-1.2, -0.8, -0.4, -0.15, 0, 0.15, 0.4, 0.8, 1.2];
  const mean = reference.reduce((sum, b) => sum + 1 / (1 + Math.exp(b - theta)), 0) / reference.length;
  return mean * 100;
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export type Calibration = { calibrated: boolean; cut_theta?: number; boletins?: number };

export type ProficiencyEstimate = {
  ready: boolean;
  responses: number;
  needed: number;
  rating: number | null;
  expected: number | null;
  low: number | null;
  high: number | null;
  /** Só existe quando houver calibração com boletins reais. */
  chanceProficient: number | null;
};

export function proficiency(responses: Response[], calibration: Calibration): ProficiencyEstimate {
  const needed = Math.max(0, MIN_RESPONSES - responses.length);
  if (responses.length < MIN_RESPONSES) {
    return { ready: false, responses: responses.length, needed, rating: null, expected: null, low: null, high: null, chanceProficient: null };
  }
  const { theta, se } = estimateTheta(responses);
  const chance =
    calibration.calibrated && typeof calibration.cut_theta === "number"
      ? normalCdf((theta - calibration.cut_theta) / se)
      : null;
  return {
    ready: true,
    responses: responses.length,
    needed: 0,
    rating: Math.round(toRating(theta)),
    expected: Math.round(expectedPercent(theta)),
    low: Math.round(expectedPercent(theta - 1.96 * se)),
    high: Math.round(expectedPercent(theta + 1.96 * se)),
    chanceProficient: chance === null ? null : Math.round(chance * 100),
  };
}
