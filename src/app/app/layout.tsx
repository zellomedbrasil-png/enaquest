import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { Emblem } from "@/components/Emblem";
import { admin } from "@/lib/supabase/admin";
import { PLACEMENT_GAMES, tierOf } from "@/lib/game/rating";
import { MascotProvider } from "@/components/MyMascot";
import { MascotBadge } from "@/components/MascotBadge";
import { TopStats } from "@/components/TopStats";
import { getMascotForPage } from "@/lib/server/mascot";
import { countDueReviews } from "@/lib/server/study";
import { getDailyIds } from "@/lib/server/daily";
import { hasPremiumAccess } from "@/lib/billing/access";
import { displayedStreak, todayBR } from "@/lib/game/streak";
import { getEntitlement, getProfile, requireUser } from "@/lib/server/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [profile, entitlement, rating, streak, mascot, dueReviews, dailyIds, dailyAnswers] = await Promise.all([
    getProfile(user.id),
    getEntitlement(user.id),
    admin().from("rating_state").select("rating, xp_total, games").eq("user_id", user.id).single(),
    admin().from("streaks").select("current, best, last_active, shields").eq("user_id", user.id).single(),
    getMascotForPage(user.id),
    countDueReviews(user.id),
    getDailyIds(todayBR()),
    admin().from("answers").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("mode", "daily").eq("context", todayBR()),
  ]);
  const inPlacement = rating.data.games < PLACEMENT_GAMES;
  const tier = tierOf(Number(rating.data.rating));

  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <div className="shell">
      <AppNav dueReviews={dueReviews} />
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
            dailyDone={dailyAnswers.count ?? 0}
            dailyTotal={dailyIds.length}
            dueReviews={dueReviews}
            premium={hasPremiumAccess(entitlement)}
          />
          <MascotBadge character={mascot.character} name={mascot.name} />
          <Link href="/app/conta" className="account-link" aria-label={`Conta de ${profile.nickname}. ${inPlacement ? "Em nivelamento" : `Patente ${tier.tier.name}`}`}>
            <Emblem rating={Number(rating.data.rating)} placement={inPlacement} size={30} />
            <span className="account-label" aria-hidden>
              <strong>{inPlacement ? "Nivelamento" : tier.tier.name}</strong>
              <small>Conta</small>
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
        <MascotProvider character={mascot.character} name={mascot.name}>
          {children}
        </MascotProvider>
      </main>
      </div>
      </div>
    </>
  );
}
