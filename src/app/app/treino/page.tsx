import type { Metadata } from "next";
import { PremiumGate } from "@/components/PremiumGate";
import { TrainingClient } from "@/components/TrainingClient";
import { admin } from "@/lib/supabase/admin";
import { isPremium, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Treino" };

export default async function TrainingPage() {
  const user = await requireUser();
  if (!(await isPremium(user.id))) {
    return <PremiumGate title="Treine do seu jeito" text="Escolha a área, refaça o que errou e monte rodadas no tamanho que couber no seu dia." />;
  }
  const db = admin();
  const { data: areas } = await db.from("matrix_areas").select("id, name, color").order("sort_order");
  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 12 }}>Treino</h1>
      <TrainingClient areas={(areas ?? []).map((area: { id: string; name: string; color: string }) => ({ ...area, published: 0 }))} />
    </div>
  );
}
