"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PREFS, playCue, readPrefs, subscribePrefs, writePrefs, type FeedbackPrefs } from "@/lib/ui/feedback";

export function useFeedbackPrefs(): FeedbackPrefs {
  return useSyncExternalStore(subscribePrefs, readPrefs, () => DEFAULT_PREFS);
}

export function FeedbackSettings() {
  const prefs = useFeedbackPrefs();
  const toggle = (key: keyof FeedbackPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    writePrefs(next);
    if (next[key]) playCue("correct");
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {(
        [
          ["sound", "Sons de acerto, erro e conquista"],
          ["vibrate", "Vibração no celular"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 36, cursor: "pointer" }}>
          <input type="checkbox" checked={prefs[key]} onChange={() => toggle(key)} style={{ width: 20, height: 20 }} />
          <span>{label}</span>
        </label>
      ))}
      <p className="dim" style={{ fontSize: 13.5 }}>
        Vale só para este aparelho.
      </p>
    </div>
  );
}
