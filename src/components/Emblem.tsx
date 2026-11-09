import { tierOf } from "@/lib/game/rating";

/** Escudo da patente. */
export function Emblem({ rating, size = 48, placement = false }: { rating: number; size?: number; placement?: boolean }) {
  const { tier, index } = tierOf(rating);
  const id = `tier-${index}-${placement ? "p" : "n"}`;
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 100 112" role="img" aria-label={placement ? "Em nivelamento" : `Patente ${tier.name}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={placement ? "#c7cbe0" : tier.from} />
          <stop offset="1" stopColor={placement ? "#7f86ad" : tier.to} />
        </linearGradient>
      </defs>
      <path d="M50 3 92 18v38c0 26-18 44-42 53C26 100 8 82 8 56V18z" fill={`url(#${id})`} />
      <path d="M50 28v50M26 53h48" stroke="rgba(0,0,0,.32)" strokeWidth="13" strokeLinecap="round" />
    </svg>
  );
}
