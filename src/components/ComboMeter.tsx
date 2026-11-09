/** Marcos em que o combo "sobe de faixa" (e toca o som de combo). */
export const COMBO_MILESTONES = [3, 5, 10, 20, 30, 50];

export function nextMilestone(combo: number): { previous: number; next: number } {
  const next = COMBO_MILESTONES.find((m) => m > combo) ?? (Math.floor(combo / 25) + 1) * 25;
  const previous = [...COMBO_MILESTONES].reverse().find((m) => m <= combo) ?? 0;
  return { previous, next };
}

/** Acertos seguidos: a barra enche até o próximo marco e quebra com tremor no erro. */
export function ComboMeter({ combo, broken }: { combo: number; broken: number }) {
  if (combo < 1 && broken < 3) return null;

  if (combo < 1) {
    return (
      <div className="combo broken" role="status">
        <span>Combo de {broken} quebrado</span>
      </div>
    );
  }

  const { previous, next } = nextMilestone(combo);
  const fill = Math.min(1, (combo - previous) / (next - previous));
  const hot = combo >= 3;

  return (
    <div className={`combo ${hot ? "hot" : ""}`} aria-label={`${combo} acertos seguidos. Próximo marco: ${next}`}>
      <b key={combo} className="combo-n xp-float">
        {combo} seguidas
      </b>
      <div className="bar combo-bar" aria-hidden>
        <i style={{ width: `${fill * 100}%` }} />
      </div>
      <span className="dim" aria-hidden>
        {next}
      </span>
    </div>
  );
}
