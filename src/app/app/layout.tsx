import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { Emblem } from "@/components/Emblem";
import { admin } from "@/lib/supabase/admin";
import { PLACEMENT_GAMES, tierOf } from "@/lib/game/rating";
import { MascotProvider } from "@/components/MyMascot";
import { TopStats } from "@/components/TopStats";
import { getMascotForPage } from "@/lib/server/mascot";
import { displayedStreak, todayBR } from "@/lib/game/streak";
import { getEntitlement, getProfile, requireUser } from "@/lib/server/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [profile, entitlement, rating, streak, mascot] = await Promise.all([
    getProfile(user.id),
    getEntitlement(user.id),
    admin().from("rating_state").select("rating, xp_total, games").eq("user_id", user.id).single(),
    admin().from("streaks").select("current, best, last_active, shields").eq("user_id", user.id).single(),
    getMascotForPage(user.id),
  ]);
  const inPlacement = rating.data.games < PLACEMENT_GAMES;
  const tier = tierOf(Number(rating.data.rating));

  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <div className="shell">
      <AppNav />
      <div className="shell-main">
      <header className="topbar">
        <div className="topbar-in">
          <Link href="/app" aria-label="Início" className="topbar-logo" style={{ textDecoration: "none" }}>
            <span className="logo" aria-hidden>
              E
            </span>
          </Link>
          <TopStats
            xpTotal={rating.data.xp_total}
            streak={displayedStreak(streak.data, todayBR())}
            shields={streak.data.shields}
            activeToday={streak.data.last_active === todayBR()}
          />
          <Link href="/app/conta" className="account-link" aria-label={`Conta de ${profile.nickname}. ${inPlacement ? "Em nivelamento" : `Patente ${tier.tier.name}`}`}>
            <Emblem rating={Number(rating.data.rating)} placement={inPlacement} size={30} />
            <span className="account-label" aria-hidden>
              Conta
            </span>
          </Link>
        </div>
      </header>
      {entitlement?.payment_problem && (
        <div className="alert alert-error" style={{ borderRadius: 0, textAlign: "center" }} role="alert">
          Não conseguimos cobrar seu cartão. <Link href="/app/conta">Atualize o pagamento</Link> para não perder o acesso.
        </div>
      )}
      <main id="conteudo" className="wrap" tabIndex={-1}>
        <MascotProvider look={mascot.look} name={mascot.name}>
          {children}
        </MascotProvider>
      </main>
      </div>
      </div>
    </>
  );
}
