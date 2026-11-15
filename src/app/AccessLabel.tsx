"use client";

import { useLinkStatus } from "next/link";

export function AccessLabel({ children }: { children: string }) {
  const { pending } = useLinkStatus();
  return <span role="status">{pending ? "Abrindo…" : children}</span>;
}
