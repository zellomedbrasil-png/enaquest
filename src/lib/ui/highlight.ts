// Grifos do enunciado: intervalos [início, fim) sobre o texto, sempre ordenados e sem sobreposição.
export type Range = [number, number];

/** Junta intervalos que se tocam ou se sobrepõem. */
export function normalize(ranges: Range[]): Range[] {
  const sorted = ranges.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const out: Range[] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/** Grifa o trecho; se ele já estava todo grifado, apaga o grifo desse trecho. */
export function toggleRange(ranges: Range[], next: Range): Range[] {
  const [s, e] = next[0] <= next[1] ? next : [next[1], next[0]];
  if (e <= s) return ranges;
  const covered = ranges.some(([rs, re]) => rs <= s && re >= e);
  if (!covered) return normalize([...ranges, [s, e]]);
  const out: Range[] = [];
  for (const [rs, re] of ranges) {
    if (re <= s || rs >= e) out.push([rs, re]);
    else {
      if (rs < s) out.push([rs, s]);
      if (re > e) out.push([e, re]);
    }
  }
  return out;
}

/** Quebra o texto em pedaços grifados e não grifados, na ordem. */
export function segments(text: string, ranges: Range[]): { text: string; marked: boolean }[] {
  const out: { text: string; marked: boolean }[] = [];
  let at = 0;
  for (const [s, e] of normalize(ranges)) {
    const start = Math.max(0, Math.min(s, text.length));
    const end = Math.max(start, Math.min(e, text.length));
    if (start > at) out.push({ text: text.slice(at, start), marked: false });
    if (end > start) out.push({ text: text.slice(start, end), marked: true });
    at = Math.max(at, end);
  }
  if (at < text.length) out.push({ text: text.slice(at), marked: false });
  return out;
}
