import type { Metadata } from "next";
import Link from "next/link";
import { Emblem } from "@/components/Emblem";
import { Flame, ShieldDots } from "@/components/Flame";
import { MyMascot } from "@/components/MyMascot";
import { MascotChat } from "@/components/MascotChat";
import { Banner, LevelBar, PageHeader, StatusPill, ToolIcon } from "@/components/ui";
import { TutorialBanner } from "@/components/TutorialBanner";
import { admin } from "@/lib/supabase/admin";
import { buildJourney, journeyStage, type JourneyStep, type StepState } from "@/lib/game/journey";
import { achievementProgress, closestAchievements } from "@/lib/game/progress";
import { PLACEMENT_GAMES, tierOf } from "@/lib/game/rating";
import { displayedStreak, MAX_SHIELDS, todayBR } from "@/lib/game/streak";
import { levelOf } from "@/lib/game/xp";
import { getDailyState } from "@/lib/server/daily";
import { countDueReviews, reviewAgenda } from "@/lib/server/study";
import { lifetimeStats, todayMissions, weekActivity } from "@/lib/server/progress";
import { getProfile, isPremium, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Hoje" };

const WEEKDAY = ["D", "S", "T", "Q", "Q", "S", "S"];
const STATE_LABEL: Record<StepState, { text: string; tone: "ok" | "today" | "pend" | "muted" }> = {
  done: { text: "Feito", tone: "ok" },
  clear: { text: "Em dia", tone: "ok" },
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
  const [profile, premium, daily, missions, rating, due, streak, week, stats, owned, answeredCount, agenda] = await Promise.all([
    getProfile(user.id),
    isPremium(user.id),
    getDailyState(user.id, day),
    todayMissions(user.id),
    admin().from("rating_state").select("rating, games, xp_total").eq("user_id", user.id).single(),
    countDueReviews(user.id),
    admin().from("streaks").select("current, best, last_active, shields").eq("user_id", user.id).single(),
    weekActivity(user.id),
    lifetimeStats(user.id),
    admin().from("achievements").select("achievement_id").eq("user_id", user.id),
    admin().from("answers").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    reviewAgenda(user.id),
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
    dueReviews: due,
    extraMissionsDone: extra.filter((m) => m.done).length,
    extraMissionsTotal: extra.length,
    nextMissionText: extra.find((m) => !m.done)?.text ?? null,
    nextMissionHref: extra.find((m) => !m.done)?.id === "m_rev5" ? "/app/revisao" : "/app/treino",
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
        : `${journey.remaining === 1 ? "Falta 1 passo" : `Faltam ${journey.remaining} passos`} para fechar o dia.`;

  return (
    <div className="two-col">
      <div className="stack">
        <PageHeader title={`Bom plantão, ${profile.nickname}`} lead={lead} />

        {stage !== "ativo" && <TutorialBanner />}

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
        <MascotChat moment="inicio" />

        <section aria-labelledby="jornada">
          <h2 id="jornada" className="section-title">
            Sua jornada de hoje
          </h2>
          <ol className="journey">
            {journey.steps.map((step, i) => (
              <Step key={step.id} step={step} index={i} />
            ))}
          </ol>
        </section>

        {missions.length > 0 && (
          <section className="card" aria-labelledby="missoes">
            <div className="card-head">
              <h2 id="missoes" className="section-title">
                Missões do dia
              </h2>
              <span className="muted">
                {missions.filter((m) => m.done).length} de {missions.length}
              </span>
            </div>
            <ul className="mission-list">
              {missions.map((mission) => (
                <li key={mission.id} className={mission.done ? "is-done" : undefined}>
                  <div className="mission-row">
                    <span>
                      {mission.done ? "✓ " : ""}
                      {mission.text}
                    </span>
                    <span className="muted">
                      {mission.current}/{mission.goal}
                    </span>
                  </div>
                  <div className="bar" aria-hidden>
                    <i style={{ width: `${Math.min(1, mission.current / mission.goal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="atalhos">
          <h2 id="atalhos" className="section-title">
            Como estudar no EnaQuest
          </h2>
          <ul className="shortcut-grid">
            {[
              { href: "/app/plantao", icon: "plantao" as const, title: "Plantão do Dia", text: "10 questões iguais para todos, todo dia. Sempre grátis.", paid: false },
              { href: "/app/revisao", icon: "revisao" as const, title: "Revisão", text: due > 0 ? `${due} ${due === 1 ? "questão voltou" : "questões voltaram"} para você.` : "O que você errar volta na hora certa.", paid: true },
              { href: "/app/treino", icon: "treino" as const, title: "Treino", text: "Escolha a área e o tamanho da rodada.", paid: true },
              { href: "/app/simulados", icon: "simulados" as const, title: "Simulados", text: "Prova completa com tempo, como no dia.", paid: true },
              { href: "/app/evolucao", icon: "evolucao" as const, title: "Evolução", text: "Veja seus pontos fortes e fracos por área.", paid: false },
              { href: "/app/ligas", icon: "ligas" as const, title: "Ligas", text: "Dispute o ranking da semana com a turma.", paid: false },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="shortcut">
                  <span className="shortcut-head">
                    <ToolIcon name={item.icon} />
                    {item.paid && !premium && <StatusPill tone="muted">Assinatura</StatusPill>}
                  </span>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </Link>
              </li>
            ))}
          </ul>
          {!premium && (
            <p className="muted" style={{ fontSize: 14, marginTop: 10 }}>
              Revisão, Treino e Simulados fazem parte da assinatura. <Link href="/planos">Ver assinatura</Link>.
            </p>
          )}
        </section>
      </div>

      <aside className="aside" aria-labelledby="progresso">
        <h2 id="progresso" className="section-title" style={{ marginBottom: 0 }}>
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

            {premium && (
              <Link href="/app/revisao" className="card agenda-mini" aria-label="Agenda de revisão">
                <p className="eyebrow">Agenda de revisão</p>
                <div className="agenda-mini-row">
                  <span>
                    <strong>{agenda[0].count}</strong> hoje
                  </span>
                  <span>
                    <strong>{agenda[1].count}</strong> amanhã
                  </span>
                  <span>
                    <strong>{agenda.reduce((sum, entry) => sum + entry.count, 0)}</strong> na semana
                  </span>
                </div>
              </Link>
            )}

            {nextAchievement && (
              <section className="card" aria-label="Próxima conquista" style={{ display: "grid", gap: 8 }}>
                <p className="eyebrow">Próxima conquista</p>
                <LevelBar
                  label={nextAchievement.name}
                  value={`${nextAchievement.current} de ${nextAchievement.goal}`}
                  progress={nextAchievement.pct}
                />
                <Link href="/app/evolucao" style={{ fontSize: 14 }}>
                  Ver todas as conquistas
                </Link>
              </section>
            )}
          </>
        )}

        <p style={{ fontSize: 14.5 }}>
          <Link href="/app/como-funciona">Como funciona o EnaQuest</Link>
        </p>
      </aside>
    </div>
  );
}
