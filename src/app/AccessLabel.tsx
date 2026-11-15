"use client";

import { useLinkStatus } from "next/link";

export function AccessLabel({ children }: { children: string }) {
  const { pending } = useLinkStatus();
  return <span aria-live="polite">{pending ? "Abrindo…" : children}</span>;
}
