"use client";

import { useCallback, useState } from "react";

export type Toast = { id: number; title: string; text?: string; tone: "gold" | "ok" | "info" };

let nextId = 1;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = nextId++;
    setToasts((current) => [...current, { ...toast, id }].slice(-3));
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4500);
  }, []);
  return { toasts, push };
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          <strong>{toast.title}</strong>
          {toast.text && <span>{toast.text}</span>}
        </div>
      ))}
    </div>
  );
}
