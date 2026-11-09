// Componentes do guia de estilo. Veja a página /guia-de-estilo.
// Todos funcionam em componentes de servidor e de cliente (sem estado).
import type { CSSProperties, ReactNode } from "react";

/** Cor de cada grande área da prova, como no guia. */
export const AREA_COLOR = {
  clinica: "var(--cm)",
  cirurgia: "var(--cir)",
  pediatria: "var(--ped)",
  go: "var(--go)",
  coletiva: "var(--prev)",
} as const;

export function Banner({
  tone,
  title,
  text,
  action,
  counter,
}: {
  tone: "danger" | "today" | "done" | "info";
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  counter?: { value: number | string; unit: string };
}) {
  return (
    <div className={`banner banner-${tone}`}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="banner-title">{title}</div>
        {text && <div className="banner-text">{text}</div>}
      </div>
      {counter && <Counter value={counter.value} unit={counter.unit} />}
      {action}
    </div>
  );
}

export function Counter({ value, unit }: { value: number | string; unit: string }) {
  return (
    <div className="counter">
      {value}
      <small>{unit}</small>
    </div>
  );
}

export function StatChip({ label, value, unit, color }: { label: string; value: ReactNode; unit?: string; color?: string }) {
  return (
    <div className="chip">
      <div className="k">{label}</div>
      <div className="v" style={color ? { color } : undefined}>
        {value}
        {unit && <small>{unit}</small>}
      </div>
    </div>
  );
}

export function StatChips({ children }: { children: ReactNode }) {
  return <div className="chips">{children}</div>;
}

/** Cartão de nível ou rating: rótulo à esquerda, valor à direita e barra embaixo. */
export function LevelBar({ label, value, progress, tone }: { label: string; value: string; progress: number; tone?: "hard" }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <div className="lvl">
      <div className="r">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <div className={`bar ${tone ?? ""}`} role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Etiqueta curta com a cor da área (CM, GO, Ped...). */
export function AreaTag({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span className="tag" style={{ background: color }}>
      {children}
    </span>
  );
}

export function StatusPill({ tone, children }: { tone: "pend" | "late" | "today" | "ok" | "bad"; children: ReactNode }) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

export function CloudBadge({ children = "Salvo na nuvem" }: { children?: ReactNode }) {
  return (
    <span className="cloud">
      <i aria-hidden />
      {children}
    </span>
  );
}

export function HardTag() {
  return <span className="hardtag">HARD</span>;
}

export function DayCard({
  day,
  month,
  meta,
  title,
  tag,
  right,
}: {
  day: ReactNode;
  month?: string;
  meta?: ReactNode;
  title: ReactNode;
  tag?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="day">
      <div className="dnum">
        <div>
          <b>{day}</b>
          <small>{month ?? "dia"}</small>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        {meta && <div className="meta">{meta}</div>}
        <div className="ttl">
          {tag}
          {title}
        </div>
      </div>
      {right}
    </div>
  );
}

/** Barras de desempenho por área: nome, barra na cor da área e porcentagem. */
export function AreaBars({ rows }: { rows: { label: string; value: number | null; color?: string; detail?: string }[] }) {
  return (
    <div className="areas">
      {rows.map((row) => (
        <div key={row.label} className="arow" title={row.detail}>
          <span>{row.label}</span>
          <div className="bar" role="progressbar" aria-label={row.label} aria-valuenow={row.value ?? 0} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${row.value ?? 0}%`, ...(row.color ? ({ background: row.color } as CSSProperties) : null) }} />
          </div>
          <span className="p">{row.value === null ? "–" : `${row.value}%`}</span>
        </div>
      ))}
    </div>
  );
}

/** Anel de resultado: porcentagem no centro e o placar embaixo. */
export function ScoreRing({ correct, total, size = 130 }: { correct: number; total: number; size?: number }) {
  const pct = total > 0 ? correct / total : 0;
  const r = 56;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${correct} de ${total} questões certas`}>
      <svg width={size} height={size} viewBox="0 0 130 130" aria-hidden>
        <circle cx="65" cy="65" r={r} fill="none" stroke="var(--track)" strokeWidth="12" />
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <div className="c">
        <div>
          <b>{Math.round(pct * 100)}%</b>
          <small>
            {correct} de {total}
          </small>
        </div>
      </div>
    </div>
  );
}

/** Mensagem do resultado conforme o desempenho. */
export function scoreMessage(correct: number, total: number): { title: string; text: string } {
  const pct = total > 0 ? correct / total : 0;
  if (pct >= 0.8) return { title: "Ótimo plantão!", text: "Você foi muito bem. Revise os erros para fixar." };
  if (pct >= 0.5) return { title: "Bom plantão!", text: "Boa base. Os erros mostram onde estudar a seguir." };
  return { title: "Plantão puxado", text: "Faz parte. Revise os erros e volte amanhã." };
}

export function ScoreCard({ correct, total, extra }: { correct: number; total: number; extra?: ReactNode }) {
  const message = scoreMessage(correct, total);
  return (
    <div className="res">
      <ScoreRing correct={correct} total={total} />
      <div>
        <h3>{message.title}</h3>
        <p>{message.text}</p>
        {extra}
      </div>
    </div>
  );
}

/** Cartão de revisão: faixa lateral verde para acerto e vermelha para erro. */
export function ReviewCard({ ok, title, children }: { ok: boolean; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={`rq ${ok ? "ok" : "bad"}`}>
      <b>{title}</b> <StatusPill tone={ok ? "ok" : "bad"}>{ok ? "acertou" : "errou"}</StatusPill>
      {children}
    </div>
  );
}
