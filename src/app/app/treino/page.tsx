import type { Metadata } from "next";
import { PremiumGate } from "@/components/PremiumGate";
import { PageHeader } from "@/components/ui";
import { TrainingClient } from "@/components/TrainingClient";
import { admin } from "@/lib/supabase/admin";
import { getEvolution } from "@/lib/server/progress";
import { isPremium, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Treino" };

export default async function TrainingPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const user = await requireUser();
  const { area: requestedArea } = await searchParams;
  if (!(await isPremium(user.id))) {
    return <PremiumGate title="Treine do seu jeito" text="Escolha a área, refaça o que errou e monte rodadas no tamanho que couber no seu dia." />;
  }
  const [{ data: areas }, evolution] = await Promise.all([
    admin().from("matrix_areas").select("id, name, color").order("sort_order"),
    getEvolution(user.id),
  ]);

  // Desempenho por área para orientar a escolha; as duas mais fracas ganham o selo "Prioridade".
  const byArea = new Map(evolution.areas.map((area) => [area.id, area]));
  const weakest = new Set(
    evolution.areas
      .filter((area) => area.pct !== null && area.pct < 70)
      .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))
      .slice(0, 2)
      .map((area) => area.id),
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader title="Treino" lead="Monte sua rodada em três passos e toque em Começar treino." />
      <TrainingClient
        areas={(areas ?? []).map((area: { id: string; name: string; color: string }) => ({
          ...area,
          published: 0,
          pct: byArea.get(area.id)?.pct ?? null,
          n: byArea.get(area.id)?.n ?? 0,
          priority: weakest.has(area.id),
        }))}
        initialAreaId={(areas ?? []).some((area: { id: string }) => area.id === requestedArea) ? (requestedArea ?? null) : null}
      />
    </div>
  );
}
