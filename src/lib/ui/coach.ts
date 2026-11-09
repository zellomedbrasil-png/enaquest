// Dicas de primeira vez: cada uma aparece uma vez por aparelho e depois some.
// O "já vi" fica em localStorage; sem ele, a dica só aparece de novo ao recarregar.

const KEY = "enaquest:coach";
const EMPTY: ReadonlySet<string> = new Set();

let memory: Set<string> | null = null;
let cache: { raw: string | null; seen: Set<string> } | null = null;
const listeners = new Set<() => void>();

/** Mesmo objeto enquanto nada mudar, como o useSyncExternalStore exige. */
export function readSeen(): ReadonlySet<string> {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (cache && cache.raw === raw) return cache.seen;
  let seen = new Set<string>();
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) seen = new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    seen = new Set();
  }
  cache = { raw, seen };
  return seen;
}

export function emptySeen(): ReadonlySet<string> {
  return EMPTY;
}

export function subscribeSeen(listener: () => void) {
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

/** Marca como vista. Devolve true só na primeira vez. */
export function markSeen(id: string): boolean {
  const current = readSeen();
  if (current.has(id)) return false;
  const next = new Set(current);
  next.add(id);
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // Sem armazenamento: a marca vale até recarregar a página.
  }
  listeners.forEach((listener) => listener());
  return true;
}
