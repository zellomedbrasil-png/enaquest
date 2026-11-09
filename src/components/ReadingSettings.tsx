"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_READING, readReading, subscribeReading, writeReading, type Reading } from "@/lib/ui/reading";

function Choice<T extends string>({
  legend,
  value,
  options,
  onPick,
}: {
  legend: string;
  value: T;
  options: [T, string][];
  onPick: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="btn btn-ghost btn-sm"
            aria-pressed={value === key}
            style={value === key ? { borderColor: "var(--accent)", background: "var(--tip-soft)" } : undefined}
            onClick={() => onPick(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ReadingSettings() {
  const reading = useSyncExternalStore(subscribeReading, readReading, () => DEFAULT_READING);
  const set = (patch: Partial<Reading>) => writeReading({ ...reading, ...patch });
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Choice legend="Tema" value={reading.theme} options={[["dark", "Escuro"], ["light", "Claro"]]} onPick={(theme) => set({ theme })} />
      <Choice legend="Tamanho do texto" value={reading.text} options={[["normal", "Normal"], ["large", "Grande"]]} onPick={(text) => set({ text })} />
      <p className="dim" style={{ fontSize: 13.5 }}>
        Vale só para este aparelho.
      </p>
    </div>
  );
}
