"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Confidence } from "@/lib/study/srs";
import { LETTERS } from "@/lib/ui/labels";
import {
  CONFIDENCE_DIALOGUES,
  MASCOT_BADGES,
  MASCOT_DIALOGUES,
  clinicalHints,
  fillLine,
  pickLine,
  seedFrom,
  type MascotStationState,
  type MascotTone,
} from "@/lib/ui/mascot-dialogues";

/** Tempo sem responder até o mascote oferecer ajuda. */
export const THINKING_TIMEOUT_MS = 75_000;

type Snapshot = {
  questionId: string;
  kind: MascotStationState;
  /** Conta os eventos da questão: muda a frase sorteada e reinicia a animação do balão. */
  step: number;
  option?: number;
  confidence?: Confidence;
  hintIndex: number;
  xp?: number;
  combo?: number;
};

const fresh = (questionId: string): Snapshot => ({ questionId, kind: "IDLE_START", step: 0, hintIndex: -1 });

export type MascotView = {
  state: MascotStationState;
  line: string;
  badge: { label: string; tone: MascotTone };
  /** Salto comemorativo: acerto ou sequência de acertos. */
  celebrate: boolean;
  /** Identificador da fala atual, para reiniciar a transição do balão. */
  lineKey: string;
  answered: boolean;
};

export type MascotHandlers = {
  onSelectOption: (index: number) => void;
  onEliminateOption: (index: number, struck: boolean) => void;
  onSelectConfidence: (level: Confidence) => void;
  onRequestHint: () => void;
  onAnswer: (result: { correct: boolean; xp: number; combo: number }) => void;
};

/**
 * Máquina de estados do mascote no card da questão. Só observa: os handlers recebem
 * os mesmos eventos da tela e nunca interferem na lógica de resposta.
 */
export function useMascotState({
  questionId,
  areaId,
  scenario,
  clinicalHint,
  timeoutMs = THINKING_TIMEOUT_MS,
}: {
  questionId: string;
  areaId?: string;
  scenario?: string;
  clinicalHint?: string | null;
  timeoutMs?: number;
}): MascotView & MascotHandlers {
  const [stored, setStored] = useState<Snapshot>(() => fresh(questionId));
  // Questão nova recomeça do zero sem precisar de efeito.
  const snap = stored.questionId === questionId ? stored : fresh(questionId);
  const answered = snap.kind === "ANSWERED_CORRECT" || snap.kind === "ANSWERED_WRONG";

  const update = useCallback(
    (change: (current: Snapshot) => Partial<Snapshot> | null) => {
      setStored((previous) => {
        const current = previous.questionId === questionId ? previous : fresh(questionId);
        const next = change(current);
        return next ? { ...current, ...next, step: current.step + 1 } : current;
      });
    },
    [questionId],
  );

  const hints = useMemo(() => clinicalHints({ clinicalHint, areaId, scenario }), [clinicalHint, areaId, scenario]);
  const seed = useMemo(() => seedFrom(questionId), [questionId]);

  // Muito tempo parado na questão: o mascote oferece um caminho (uma vez por questão).
  const idleForHelp = !answered && snap.kind !== "HINT_REQUESTED" && snap.kind !== "THINKING_TIMEOUT";
  useEffect(() => {
    if (!idleForHelp) return;
    const timer = window.setTimeout(() => {
      update((current) =>
        current.kind === "HINT_REQUESTED" || current.kind.startsWith("ANSWERED") || current.kind === "THINKING_TIMEOUT"
          ? null
          : { kind: "THINKING_TIMEOUT" },
      );
    }, timeoutMs);
    return () => window.clearTimeout(timer);
    // O relógio conta desde a entrada na questão, não desde o último clique.
  }, [questionId, idleForHelp, timeoutMs, update]);

  const line = useMemo(() => {
    const at = seed + snap.step;
    switch (snap.kind) {
      case "CONFIDENCE_SELECTED":
        return pickLine(CONFIDENCE_DIALOGUES[snap.confidence ?? "duvida"], at);
      case "HINT_REQUESTED":
        return hints[snap.hintIndex % hints.length];
      default:
        return fillLine(pickLine(MASCOT_DIALOGUES[snap.kind], at), {
          option: snap.option !== undefined ? LETTERS[snap.option] : undefined,
          xp: snap.xp,
        });
    }
  }, [snap.kind, snap.step, snap.confidence, snap.hintIndex, snap.option, snap.xp, seed, hints]);

  const badgeBase = MASCOT_BADGES[snap.kind];
  const badge = { tone: badgeBase.tone, label: fillLine(badgeBase.label, { xp: snap.xp }) };

  return {
    state: snap.kind,
    line,
    badge,
    celebrate: snap.kind === "ANSWERED_CORRECT",
    lineKey: `${questionId}:${snap.step}`,
    answered,
    onSelectOption: (index) => update((c) => (c.kind.startsWith("ANSWERED") ? null : { kind: "OPTION_SELECTED", option: index })),
    onEliminateOption: (index, struck) =>
      // Só reage ao riscar; desfazer o risco não precisa de comentário.
      update((c) => (!struck || c.kind.startsWith("ANSWERED") ? null : { kind: "OPTION_ELIMINATED", option: index })),
    onSelectConfidence: (level) => update((c) => (c.kind.startsWith("ANSWERED") ? null : { kind: "CONFIDENCE_SELECTED", confidence: level })),
    onRequestHint: () => update((c) => (c.kind.startsWith("ANSWERED") ? null : { kind: "HINT_REQUESTED", hintIndex: c.hintIndex + 1 })),
    onAnswer: ({ correct, xp, combo }) => update(() => ({ kind: correct ? "ANSWERED_CORRECT" : "ANSWERED_WRONG", xp, combo })),
  };
}
