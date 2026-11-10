import type { Metadata } from "next";
import Link from "next/link";
import { Emblem } from "@/components/Emblem";
import { Flame, ShieldDots } from "@/components/Flame";
import { MyMascot } from "@/components/MyMascot";
import { Banner, LevelBar, PageHeader, StatusPill } from "@/components/ui";
import { admin } from "@/lib/supabase/admin";
import { buildJourney, journeyStage, type JourneyStep, type StepState } from "@/lib/game/journey";
import { achievementProgress, closestAchievements } from "@/lib/game/progress";
import { PLACEMENT_GAMES, tierOf } from "@/lib/game/rating";
import { displayedStreak, MAX_SHIELDS, todayBR } from "@/lib/game/streak";
import { levelOf } from "@/lib/game/xp";
import { getDailyState } from "@/lib/server/daily";
import { getMascotForPage } from "@/lib/server/mascot";
import { lifetimeStats, todayMissions, weekActivity } from "@/lib/server/progress";
import { getProfile, isPremium, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Hoje" };

const WEEKDAY = ["D", "S", "T", "Q", "Q", "S", "S"];
const STATE_LABEL: Record<StepState, { text: string; tone: "ok" | "today" | "pend" | "muted" }> = {
  done: { text: "Feito", tone: "ok" },
  now: { text: "Agora", tone: "today" },
  next: { text: "Depois", tone: "muted" },
  locked: { text: "Trancado", tone: "muted" },
};

function Step({ step, index }: { step: JourneyStep; index: number }) {
  const label = STATE_LABEL[step.state];
  const body = (
    <>
      <span className="step-num" aria-hidden>
        {step.state === "done" ? "✓" : index + 1}
      </span>
      <span style={{ minWidth: 0 }}>
        <h3>{step.title}</h3>
        <p>{step.detail}</p>
      </span>
      <StatusPill tone={label.tone}>{label.text}</StatusPill>
    </>
  );
  const className = `step ${step.state}`;
  return <li>{step.href && step.state !== "locked" ? <Link href={step.href} className={className}>{body}</Link> : <div className={className}>{body}</div>}</li>;
}

export default async function TodayPage() {
  const user = await requireUser();
  const day = todayBR();
  const [profile, premium, daily, missions, rating, due, streak, week, stats, owned, answeredCount, mascot] = await Promise.all([
    getProfile(user.id),
    isPremium(user.id),
    getDailyState(user.id, day),
    todayMissions(user.id),
    admin().from("rating_state").select("rating, games, xp_total").eq("user_id", user.id).single(),
    admin().from("srs_cards").select("question_id", { count: "exact", head: true }).eq("user_id", user.id).lte("due", new Date().toISOString()),
    admin().from("streaks").select("current, best, last_active, shields").eq("user_id", user.id).single(),
    weekActivity(user.id),
    lifetimeStats(user.id),
    admin().from("achievements").select("achievement_id").eq("user_id", user.id),
    admin().from("answers").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    getMascotForPage(user.id),
  ]);

  const stage = journeyStage({ answered: answeredCount.count ?? 0, ratedGames: rating.data.games });
  const answered = Object.keys(daily.answered).length;
  const hits = Object.values(daily.answered).filter((a) => a.correct).length;
  const extra = missions.filter((m) => m.id !== "m_daily");
  const journey = buildJourney({
    premium,
    dailyTotal: daily.questions.length,
    dailyAnswered: answered,
    dailyHits: hits,
    dueReviews: due.count ?? 0,
    extraMissionsDone: extra.filter((m) => m.done).length,
    extraMissionsTotal: extra.length,
    nextMissionText: extra.find((m) => !m.done)?.text ?? null,
  });

  const shownStreak = displayedStreak(streak.data, day);
  const activeToday = streak.data.last_active === day;
  const value = Number(rating.data.rating);
  const { tier, next: nextTier } = tierOf(value);
  const level = levelOf(rating.data.xp_total);
  const nextAchievement = closestAchievements(
    achievementProgress(stats, new Set((owned.data ?? []).map((a: { achievement_id: string }) => a.achievement_id))),
    1,
  )[0];

  // O mascote reage ao dia: feliz com tudo feito, preocupado com a sequência em risco.
  const mood = journey.next.allDone ? "feliz" : !activeToday && shownStreak > 0 ? "preocupado" : "neutro";

  const lead =
    stage === "novo"
      ? "Vamos começar. Siga os passos abaixo, um de cada vez."
      : journey.next.allDone
        ? "Você fechou o dia. Sua sequência está garantida."
        : `Faltam ${journey.remaining} ${journey.remaining === 1 ? "passo" : "passos"} para fechar o dia.`;

  return (
    <div className="two-col">
      <div className="stack">
        <PageHeader title={`Bom plantão, ${profile.nickname}`} lead={lead} />

        <Banner
          tone={journey.next.allDone ? "done" : "today"}
          title={journey.next.title}
          text={journey.next.text}
          media={<MyMascot mood={mood} size={78} />}
          action={
            journey.next.cta && journey.next.href ? (
              <Link href={journey.next.href} className={journey.next.allDone ? "btn btn-ghost" : "btn btn-dark"}>
                {journey.next.cta}
              </Link>
            ) : undefined
          }
        />

        <section aria-labelledby="jornada">
          <h2 id="jornada" style={{ fontSize: 20, marginBottom: 10 }}>
            Sua jornada de hoje
          </h2>
          <ol className="journey">
            {journey.steps.map((step, i) => (
              <Step key={step.id} step={step} index={i} />
            ))}
          </ol>
        </section>

        {!premium && (
          <p className="muted" style={{ fontSize: 14.5 }}>
            Quer estudar além do Plantão? Revisão, Treino e Simulados fazem parte da assinatura. <Link href="/planos">Ver assinatura</Link>.
          </p>
        )}
      </div>

      <aside className="aside" aria-labelledby="progresso">
        <h2 id="progresso" style={{ fontSize: 20 }}>
          Seu progresso
        </h2>

        {stage === "novo" ? (
          <section className="card">
            <p>
              Responda sua primeira questão para acender a chama da sequência, ganhar XP e começar a subir de nível.
            </p>
            <p className="dim" style={{ marginTop: 8, fontSize: 14.5 }}>
              Suas 20 primeiras questões calibram seu rating. Errar no começo quase não tira pontos.
            </p>
          </section>
        ) : (
          <>
            <section className="card" aria-label="Sequência">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Flame lit={activeToday && shownStreak > 0} size={34} />
                <div>
                  <div className="display" style={{ fontSize: 24 }}>
                    {shownStreak} {shownStreak === 1 ? "dia seguido" : "dias seguidos"}
                  </div>
                  <p className="muted" style={{ fontSize: 14 }}>
                    {activeToday ? "Garantida hoje." : shownStreak > 0 ? "Responda uma questão hoje para manter." : "Responda uma questão para acender."}
                  </p>
                </div>
              </div>
              <ul className="week-dots" style={{ marginTop: 12 }} aria-label="Atividade dos últimos 7 dias">
                {week.map((item) => (
                  <li key={item.day} className={`${item.active ? "on" : ""} ${item.day === day ? "today" : ""}`}>
                    <i aria-hidden>{item.active ? "✓" : ""}</i>
                    <span className="sr-only">{item.active ? "Estudou em " : "Sem estudo em "}</span>
                    {WEEKDAY[new Date(`${item.day}T12:00:00Z`).getUTCDay()]}
                  </li>
                ))}
              </ul>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12 }}>
                <span className="muted" style={{ fontSize: 14 }}>
                  Trocas de plantão
                </span>
                <ShieldDots count={streak.data.shields} max={MAX_SHIELDS} />
              </div>
              <p className="dim" style={{ fontSize: 13.5, marginTop: 2 }}>
                Cobrem um dia sem estudo. Você ganha uma a cada 7 dias seguidos.
              </p>
            </section>

            <section className="card" aria-label="Nível e patente" style={{ display: "grid", gap: 14 }}>
              <LevelBar
                label={`Nível: ${level.current.name}`}
                value={`${rating.data.xp_total} XP`}
                progress={level.progress}
              />
              {level.next && (
                <p className="dim" style={{ fontSize: 13.5, marginTop: -6 }}>
                  Faltam {level.toNext} XP para {level.next.name}. XP vem de responder, revisar e marcar o motivo dos erros.
                </p>
              )}
              {stage === "nivelamento" ? (
                <div>
                  <p className="eyebrow">Nivelamento</p>
                  <LevelBar label="Questões de calibragem" value={`${rating.data.games} de ${PLACEMENT_GAMES}`} progress={rating.data.games / PLACEMENT_GAMES} />
                  <p className="dim" style={{ fontSize: 13.5, marginTop: 6 }}>
                    Ao terminar, você recebe sua patente. Até lá, errar tira poucos pontos.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Emblem rating={value} size={46} />
                  <div>
                    <p className="eyebrow">Sua patente</p>
                    <div className="display" style={{ fontSize: 20 }}>
                      {tier.name}
                    </div>
                    <p className="muted" style={{ fontSize: 14 }}>
                      Rating {Math.round(value)}
                      {nextTier ? `. Faltam ${Math.ceil(nextTier.min - value)} para ${nextTier.name}.` : ""}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {nextAchievement && (
              <p className="muted" style={{ fontSize: 14.5 }}>
                Próxima conquista: <strong>{nextAchievement.name}</strong>, {nextAchievement.current} de {nextAchievement.goal}.{" "}
                <Link href="/app/evolucao">Ver conquistas</Link>
              </p>
            )}
          </>
        )}

        <Link href="/app/mascote" className="card mascot-card">
          <MyMascot mood={mood} size={72} background />
          <span>
            <strong>{mascot.name}</strong>
            <span className="muted">{mascot.balance} XP para gastar. Abrir a lojinha do mascote.</span>
          </span>
          <span aria-hidden>→</span>
        </Link>

        <p style={{ fontSize: 14.5 }}>
          <Link href="/app/como-funciona">Como funciona o EnaQuest</Link>
        </p>
      </aside>
    </div>
  );
}
