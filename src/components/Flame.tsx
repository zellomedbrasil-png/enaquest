/** Chama da sequência: acesa quando o jogador já estudou hoje, apagada quando ainda não. */
export function Flame({ lit = true, size = 20 }: { lit?: boolean; size?: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 24 30" aria-hidden className={lit ? "flame lit" : "flame"}>
      <path
        d="M12 1c1 5 7 8 7 16a7 7 0 0 1-14 0c0-3 1.5-5 3-6.5.3 2 1.2 3 2.2 3.5C9.500 9 10 5 12 1Z"
        fill={lit ? "var(--coral-fill)" : "var(--line)"}
      />
      <path d="M12 14c.8 2.200 3.500 3.200 3.500 6.200a3.500 3.500 0 0 1-7 0c0-1.800 1.200-2.700 2-3.700.4 1 .9 1.300 1.500 1.700Z" fill={lit ? "var(--gold-fill)" : "var(--dim)"} />
    </svg>
  );
}

/** Escudos de "troca de plantão": cheios os que o jogador tem, vazios os que cabem. */
export function ShieldDots({ count, max }: { count: number; max: number }) {
  return (
    <span className="shield-dots" role="img" aria-label={`${count} de ${max} trocas de plantão`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} width="11" height="13" viewBox="0 0 12 14" aria-hidden>
          <path d="M6 1 11 3v4c0 3-2.200 5-5 6-2.800-1-5-3-5-6V3z" fill={i < count ? "var(--sky)" : "none"} stroke={i < count ? "var(--sky)" : "var(--dim)"} strokeWidth="1.200" />
        </svg>
      ))}
    </span>
  );
}
