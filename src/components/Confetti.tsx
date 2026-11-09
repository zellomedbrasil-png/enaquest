"use client";

const COLORS = ["#c8f542", "#5bc0ff", "#ff6b5b", "#ffd84d", "#b39dff", "#7ee8a2"];

// Posições fixas: o desenho é só comemorativo e evita diferença entre servidor e cliente.
const PIECES = Array.from({ length: 44 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${((i * 53) % 90) / 100}s`,
  color: COLORS[i % COLORS.length],
}));

export function Confetti() {
  return (
    <div className="confetti" aria-hidden>
      {PIECES.map((piece, i) => (
        <i key={i} style={{ left: piece.left, background: piece.color, animationDelay: piece.delay }} />
      ))}
    </div>
  );
}
