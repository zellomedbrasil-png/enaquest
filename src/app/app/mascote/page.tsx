import type { Metadata } from "next";
import Link from "next/link";
import { MascotPicker } from "@/components/MascotPicker";
import { PageHeader } from "@/components/ui";
import { PLACEMENT_GAMES, tierOf } from "@/lib/game/rating";
import { displayedStreak, todayBR } from "@/lib/game/streak";
import { levelOf } from "@/lib/game/xp";
import { getMascotForPage } from "@/lib/server/mascot";
import { requireUser } from "@/lib/server/session";
import { admin } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Mascote" };

export default async function MascotPage() {
  const user = await requireUser();
  const [view, rating, streak] = await Promise.all([
    getMascotForPage(user.id),
    admin().from("rating_state").select("rating, xp_total, games").eq("user_id", user.id).single(),
    admin().from("streaks").select("current, best, last_active, shields").eq("user_id", user.id).single(),
  ]);
  const xp = Number(rating.data?.xp_total ?? 0);
  const placement = Number(rating.data?.games ?? 0) < PLACEMENT_GAMES;
  const stats = {
    level: levelOf(xp).current.name,
    xp,
    streak: streak.data ? displayedStreak(streak.data, todayBR()) : 0,
    patente: placement ? "Nivelamento" : tierOf(Number(rating.data?.rating ?? 0)).tier.name,
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader title="Seu mascote" lead="Escolha o parceiro que vai dividir o plantão com você." />
      <MascotPicker initial={view} stats={stats} />
      <p className="muted" style={{ fontSize: 14.5 }}>
        Procurando seu perfil ou a assinatura? <Link href="/app/conta">Abrir Conta</Link>.
      </p>
    </div>
  );
}
