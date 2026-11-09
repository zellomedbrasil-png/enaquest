// Preferências de leitura deste aparelho: tema escuro ou claro e tamanho do texto.
// A fonte da verdade são os atributos data-* de <html>; um script no <head> os aplica antes da pintura.

export type Reading = { theme: "dark" | "light"; text: "normal" | "large" };

export const READING_KEY = "enaquest:reading";
export const DEFAULT_READING: Reading = { theme: "dark", text: "normal" };

/** Roda no <head> antes da primeira pintura, para não piscar o tema errado. */
export const READING_SCRIPT = `try{var r=JSON.parse(localStorage.getItem("${READING_KEY}")||"{}"),d=document.documentElement;if(r.theme==="light")d.dataset.theme="light";if(r.text==="large")d.dataset.text="large"}catch(e){}`;

const listeners = new Set<() => void>();
let cache: Reading = DEFAULT_READING;

export function readReading(): Reading {
  const d = document.documentElement.dataset;
  const theme = d.theme === "light" ? "light" : "dark";
  const text = d.text === "large" ? "large" : "normal";
  if (cache.theme !== theme || cache.text !== text) cache = { theme, text };
  return cache;
}

export function writeReading(next: Reading) {
  const d = document.documentElement.dataset;
  if (next.theme === "light") d.theme = "light";
  else delete d.theme;
  if (next.text === "large") d.text = "large";
  else delete d.text;
  try {
    localStorage.setItem(READING_KEY, JSON.stringify(next));
  } catch {
    // Sem armazenamento: vale até recarregar a página.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeReading(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
