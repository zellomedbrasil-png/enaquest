// Sorteios determinísticos e proporcionais às áreas da prova. Sem dependência de banco, para testar.

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  const out = [...items];
  let state = hashString(seed) || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type PoolItem = { id: string; area_id: string };
export type AreaShare = { id: string; exam_share: number | string };

/** Quantas questões por área, pelo método do maior resto. */
export function quotas(areas: AreaShare[], size: number): Record<string, number> {
  const total = areas.reduce((sum, a) => sum + Number(a.exam_share), 0) || 1;
  const raw = areas.map((a) => {
    const exact = (Number(a.exam_share) / total) * size;
    return { id: a.id, floor: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = size - raw.reduce((sum, r) => sum + r.floor, 0);
  for (const r of [...raw].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break;
    r.floor += 1;
    left -= 1;
  }
  return Object.fromEntries(raw.map((r) => [r.id, r.floor]));
}

export function pickBalanced(pool: PoolItem[], areas: AreaShare[], seed: string, size: number): string[] {
  const shuffled = seededShuffle(pool, seed);
  const quota = quotas(areas, size);
  const chosen: string[] = [];
  const leftovers: string[] = [];
  for (const item of shuffled) {
    if ((quota[item.area_id] ?? 0) > 0) {
      quota[item.area_id] -= 1;
      chosen.push(item.id);
    } else {
      leftovers.push(item.id);
    }
  }
  // Se alguma área não tiver questões suficientes, completa com as demais.
  for (const id of leftovers) {
    if (chosen.length >= size) break;
    chosen.push(id);
  }
  return seededShuffle(chosen.slice(0, size), seed + ":ordem");
}

export const pickDaily = pickBalanced;

/** Amostra de revisão: inclui primeiro as questões de alto risco, até 40% da amostra. */
export function pickReviewSample(
  questions: { id: string; risk_level: string }[],
  seed: string,
  sampleSize: number,
): string[] {
  if (questions.length <= sampleSize) return questions.map((q) => q.id);
  const high = seededShuffle(questions.filter((q) => q.risk_level === "alto"), seed);
  const normal = seededShuffle(questions.filter((q) => q.risk_level !== "alto"), seed);
  const highTake = Math.min(high.length, Math.ceil(sampleSize * 0.4));
  const picked = high.slice(0, highTake);
  const rest = [...normal, ...high.slice(highTake)];
  return [...picked, ...seededShuffle(rest, seed + ":resto").slice(0, sampleSize - picked.length)].map((q) => q.id);
}
