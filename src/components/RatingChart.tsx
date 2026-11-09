"use client";

import { useState } from "react";
import { formatDate } from "@/lib/ui/labels";

const W = 640;
const H = 180;
const PAD = { top: 12, right: 14, bottom: 22, left: 38 };

/** Evolução do rating: uma série, uma escala, com leitura ao passar o dedo ou o mouse. */
export function RatingChart({ data }: { data: { day: string; rating: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) {
    return <p className="muted">O gráfico aparece depois de dois dias com questões respondidas.</p>;
  }

  const values = data.map((d) => d.rating);
  const min = Math.floor(Math.min(...values) / 50) * 50 - 50;
  const max = Math.ceil(Math.max(...values) / 50) * 50 + 50;
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * (H - PAD.top - PAD.bottom);
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.rating).toFixed(1)}`).join(" ");
  const ticks = [min, Math.round((min + max) / 2), max];
  const active = hover ?? data.length - 1;
  const point = data[active];

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Rating de ${data[0].rating} em ${formatDate(data[0].day + "T12:00:00")} para ${data[data.length - 1].rating} em ${formatDate(data[data.length - 1].day + "T12:00:00")}`}
        style={{ display: "block", touchAction: "pan-y" }}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const rel = ((event.clientX - box.left) / box.width) * W;
          const i = Math.round(((rel - PAD.left) / (W - PAD.left - PAD.right)) * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--dim)">
              {t}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--chart)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--dim)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx={x(active)} cy={y(point.rating)} r="5" fill="var(--chart)" stroke="var(--card)" strokeWidth="2" />
        <text x={PAD.left} y={H - 6} fontSize="11" fill="var(--dim)">
          {formatDate(data[0].day + "T12:00:00")}
        </text>
        <text x={W - PAD.right} y={H - 6} fontSize="11" fill="var(--dim)" textAnchor="end">
          {formatDate(data[data.length - 1].day + "T12:00:00")}
        </text>
      </svg>
      <figcaption className="muted" style={{ fontSize: 13.5 }} aria-live="polite">
        {formatDate(point.day + "T12:00:00")}: rating <strong>{point.rating}</strong>
      </figcaption>
    </figure>
  );
}

/** Barras de desempenho: mesma cor, um valor por linha, sem depender de cor para ler. */
export function PerformanceBars({ rows }: { rows: { label: string; value: number | null; detail: string; color?: string }[] }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {rows.map((row) => (
        <div key={row.label} title={row.detail}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
            <span>
              {row.color && <i className="area-dot" style={{ background: row.color, marginRight: 8 }} />}
              {row.label}
            </span>
            <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
              {row.value === null ? row.detail : `${row.value}% · ${row.detail}`}
            </span>
          </div>
          <div className="bar" style={{ marginTop: 4 }}>
            <i style={{ width: `${row.value ?? 0}%`, ...(row.color ? { background: row.color } : null) }} />
          </div>
        </div>
      ))}
    </div>
  );
}
