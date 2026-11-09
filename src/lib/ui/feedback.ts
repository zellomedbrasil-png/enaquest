// Som e vibração curtos para acerto, erro, combo e subida de nível.
// As preferências ficam só neste aparelho (localStorage) e funcionam sem ele.

export type Cue = "correct" | "wrong" | "combo" | "levelup" | "achievement";
export type FeedbackPrefs = { sound: boolean; vibrate: boolean };

const KEY = "enaquest:feedback";
export const DEFAULT_PREFS: FeedbackPrefs = { sound: true, vibrate: true };

let cache: { raw: string | null; prefs: FeedbackPrefs } | null = null;
let memory: FeedbackPrefs | null = null;
const listeners = new Set<() => void>();

/** Devolve sempre o mesmo objeto enquanto nada mudar (exigência do useSyncExternalStore). */
export function readPrefs(): FeedbackPrefs {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return DEFAULT_PREFS;
  }
  if (cache && cache.raw === raw) return cache.prefs;
  let prefs = DEFAULT_PREFS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<FeedbackPrefs>;
      prefs = { sound: parsed.sound !== false, vibrate: parsed.vibrate !== false };
    } catch {
      prefs = DEFAULT_PREFS;
    }
  }
  cache = { raw, prefs };
  return prefs;
}

export function writePrefs(prefs: FeedbackPrefs) {
  memory = prefs;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Sem armazenamento: a escolha vale até recarregar a página.
  }
  listeners.forEach((listener) => listener());
}

export function subscribePrefs(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      memory = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// [frequência em Hz, início em s, duração em s]
const MELODY: Record<Cue, { wave: OscillatorType; notes: [number, number, number][]; vibrate: number[] }> = {
  correct: { wave: "sine", notes: [[660, 0, 0.09], [880, 0.08, 0.13]], vibrate: [15] },
  wrong: { wave: "triangle", notes: [[220, 0, 0.14], [165, 0.12, 0.2]], vibrate: [40, 30, 40] },
  combo: { wave: "sine", notes: [[523, 0, 0.08], [659, 0.07, 0.08], [784, 0.14, 0.16]], vibrate: [20, 30, 20, 30, 40] },
  levelup: { wave: "sine", notes: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.28]], vibrate: [30, 40, 30, 40, 80] },
  achievement: { wave: "sine", notes: [[784, 0, 0.1], [988, 0.1, 0.1], [1319, 0.2, 0.24]], vibrate: [25, 30, 60] },
};

let audio: AudioContext | null = null;

function playNotes(cue: Cue) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    if (audio.state === "suspended") void audio.resume();
    const { wave, notes } = MELODY[cue];
    const now = audio.currentTime;
    for (const [freq, start, length] of notes) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.07, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + start);
      osc.stop(now + start + length + 0.02);
    }
  } catch {
    // Áudio indisponível: o jogo segue sem som.
  }
}

export function playCue(cue: Cue) {
  if (typeof window === "undefined") return;
  const prefs = readPrefs();
  if (prefs.sound) playNotes(cue);
  if (prefs.vibrate && typeof navigator.vibrate === "function") navigator.vibrate(MELODY[cue].vibrate);
}
