import type { Metadata } from "next";
import Link from "next/link";
import { Emblem } from "@/components/Emblem";
import { Flame, ShieldDots } from "@/components/Flame";
import { MyMascot } from "@/components/MyMascot";
import { Banner, LevelBar, StatusPill, ToolIcon } from "@/components/ui";
import { admin } from "@/lib/supabase/admin";
import { buildJourney, journeyStage, type JourneyStep, type StepState } from "@/lib/game/journey";
import { achievementProgress, closestAchievements } from "@/lib/game/progress";
import { PLACEMENT_GAMES, tierOf } from "@/lib/game/rating";
import { displayedStreak, MAX_SHIELDS, todayBR } from "@/lib/game/streak";
import { levelOf } from "@/lib/game/xp";
import { getDailyState } from "@/lib/server/daily";
import { countDueReviews, reviewAgenda } from "@/lib/server/study";
import { getDayView } from "@/lib/server/day-plan";
import { firstNameOf } from "@/lib/server/onboarding";
import { StudyGoalsForm } from "@/components/StudyGoalsForm";
import { lifetimeStats, todayMissions, weekActivity } from "@/lib/server/progress";
import { getProfile, isPremium, requireUser } from "@/lib/server/session";
import type { DayPhase } from "@/lib/study/day-plan";
import { minutesLabel } from "@/lib/study/onboarding";

export const metadata: Metadata = { title: "Hoje" };

const WEEKDAY = ["D", "S", "T", "Q", "Q", "S", "S"];
const EXAM_LABEL = { enamed: "ENAMED", enare: "ENARE" } as const;
const PHASES: { key: DayPhase; name: string; text: string }[] = [
  { key: "base", name: "Base", text: "Passar pela matéria toda, no peso de cada área na prova." },
  { key: "consolidacao", name: "Consolidação", text: "Mais revisão e mais questões nas áreas em que você erra." },
  { key: "reta", name: "Reta final", text: "Um simulado por semana e revisão do que mais cai." },
];
const STATE_LABEL: Record<StepState, { text: string; tone: "ok" | "today" | "pend" | "muted" }> = {
  done: { text: "Feito", tone: "ok" },
  clear: { text: "Em dia", tone: "ok" },
  now: { text: "Agora", tone: "today" },
  next: { text: "Depois", tone: "muted" },
  locked: { text: "Trancado", tone: "muted" },
};

function Step({ step, index }: { step: JourneyStep; index: number }) {
  const label = step.optional && step.state === "next" ? { text: "Sugestão", tone: "muted" as const } : STATE_LABEL[step.state];
  const showProgress = step.target !== undefined && step.target > 0 && step.state !== "locked" && (step.done ?? 0) > 0 && step.state !== "done";
  const body = (
    <>
      <span className="step-num" aria-hidden>
        {step.state === "done" ? "✓" : index + 1}
      </span>
      <span style={{ minWidth: 0 }}>
        <h3>{step.title}</h3>
        <p>{step.detail}</p>
        {showProgress && (
          <span className="bar step-progress" aria-hidden>
            <i style={{ width: `${Math.min(1, (step.done ?? 0) / (step.target ?? 1)) * 100}%` }} />
          </span>
        )}
      </span>
      <StatusPill tone={label.tone}>{label.text}</StatusPill>
    </>
  );
  const className = `step ${step.state}${step.optional ? " optional" : ""}`;
  return <li>{step.href && step.state !== "locked" ? <Link href={step.href} className={className}>{body}</Link> : <div className={className}>{body}</div>}</li>;
}

function longDate(day: string): string {
  const text = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function examMonth(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export default async function TodayPage() {
  const user = await requireUser();
  const day = todayBR();
  const [profile, premium, daily, missions, rating, due, streak, week, stats, owned, answeredCount, agenda, dayView] = await Promise.all([
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
    getDayView(user.id),
  ]);
  const dayPlan = dayView.plan;
  const goals = dayView.goals;
  const name = firstNameOf(user) ?? profile.nickname;

  const totalAnswered = answeredCount.count ?? 0;
  const stage = journeyStage({ answered: totalAnswered, ratedGames: rating.data.games });
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
    day: dayPlan,
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

  // Questões do dia: o que o plano pede hoje e o que já foi feito, sem o simulado (que é sugestão).
  const counted = dayPlan.blocks.filter((b) => b.kind !== "simulado");
  const dayTarget = counted.reduce((sum, b) => sum + b.target, 0);
  const dayDone = counted.reduce((sum, b) => sum + Math.min(b.done, b.target), 0);
  const dayPct = dayTarget > 0 ? dayDone / dayTarget : 0;

  const mood = journey.next.allDone ? "feliz" : !activeToday && shownStreak > 0 ? "preocupado" : "neutro";
  const lead =
    stage === "novo"
      ? "Seu primeiro dia começa pelo Plantão. São 10 questões comentadas, e a primeira resposta acende sua sequência."
      : journey.next.allDone
        ? "Você fechou o dia. Sua sequência está garantida."
        : `${journey.remaining === 1 ? "Falta 1 passo" : `Faltam ${journey.remaining} passos`} para fechar o dia.`;

  const firstSteps = [
    { done: goals.set, title: "Montar seu percurso", text: "Prova, tempo por dia e mês da prova.", href: "/comecar" },
    { done: totalAnswered > 0, title: "Responder a primeira questão", text: "O Plantão de hoje já está pronto.", href: "/app/plantao" },
    {
      done: rating.data.games >= PLACEMENT_GAMES,
      title: "Calibrar seu nível",
      text: `${Math.min(rating.data.games, PLACEMENT_GAMES)} de ${PLACEMENT_GAMES} questões. Depois vem sua patente.`,
      href: "/app/plantao",
    },
    { done: owned.data !== null && (owned.data ?? []).length > 0, title: "Ganhar a primeira conquista", text: "Vem com as primeiras respostas certas.", href: "/app/evolucao" },
  ];
  const firstStepsDone = firstSteps.filter((s) => s.done).length;

  const areas = [...dayView.areas].sort((a, b) => b.share - a.share);
  const maxShare = Math.max(...areas.map((a) => a.share), 0.01);
  const weak = new Set(dayPlan.weakAreas);
  const phaseIndex = PHASES.findIndex((p) => p.key === dayPlan.phase);

  return (
    <div className="two-col">
      <div className="stack">
        <section className="today-hero" aria-labelledby="hoje-titulo">
          <div className="today-hero-text">
            <p className="eyebrow">{longDate(day)}</p>
            <h1 id="hoje-titulo">Bom plantão, {name}</h1>
            <p className="lead">{lead}</p>
          </div>
          <dl className="today-stats">
            <div>
              <dt>Prova</dt>
              {goals.set ? (
                <dd>
                  <strong>{EXAM_LABEL[goals.targetExam]}</strong>
                  <small>
                    {dayPlan.daysLeft === null
                      ? "data a definir"
                      : dayPlan.daysLeft === 0
                        ? "é hoje"
                        : `em ${dayPlan.daysLeft} ${dayPlan.daysLeft === 1 ? "dia" : "dias"}`}
                  </small>
                </dd>
              ) : (
                <dd>
                  <Link href="/comecar">Definir</Link>
                  <small>leva 1 minuto</small>
                </dd>
              )}
            </div>
            <div>
              <dt>Hoje</dt>
              <dd>
                <strong>
                  {dayDone}
                  <span className="today-stats-of">/{dayTarget}</span>
                </strong>
                <small>questões · {minutesLabel(dayPlan.minutes)}</small>
                <span className="bar" aria-hidden>
                  <i style={{ width: `${dayPct * 100}%` }} />
                </span>
              </dd>
            </div>
            <div>
              <dt>Sequência</dt>
              <dd>
                <strong className="today-stats-flame">
                  <Flame lit={activeToday && shownStreak > 0} size={20} />
                  {shownStreak}
                </strong>
                <small>{activeToday ? "garantida hoje" : shownStreak > 0 ? "responda hoje para manter" : "acende na 1ª resposta"}</small>
              </dd>
            </div>
          </dl>
        </section>

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

        {!goals.set && (
          <section className="setup-card" aria-labelledby="percurso">
            <div>
              <p className="eyebrow">Plano personalizado</p>
              <h2 id="percurso">Monte seu percurso até a prova</h2>
              <p>Quatro perguntas rápidas: prova, tempo por dia, perfil e mês da prova. O EnaQuest ajusta o dia ao seu ritmo e às áreas em que você vai pior.</p>
            </div>
            <Link href="/comecar" className="btn btn-primary">
              Montar agora →
            </Link>
          </section>
        )}

        <section aria-labelledby="jornada">
          <div className="card-head" style={{ marginBottom: 8 }}>
            <h2 id="jornada" className="section-title" style={{ marginBottom: 0 }}>
              Sua jornada de hoje
            </h2>
            <span className="muted" style={{ fontSize: 14 }}>
              cerca de {dayPlan.plannedMinutes} min
            </span>
          </div>
          {goals.set && (
            <div style={{ marginBottom: 10 }}>
              <StudyGoalsForm initial={goals} today={day} compact />
            </div>
          )}
          {dayPlan.plannedMinutes > dayPlan.minutes && (
            <p className="dim" style={{ fontSize: 13.5, marginBottom: 8 }}>
              O Plantão sozinho já passa do seu tempo de hoje. O resto entra quando você tiver mais minutos.
            </p>
          )}
          <ol className="journey">
            {journey.steps.map((step, i) => (
              <Step key={step.id} step={step} index={i} />
            ))}
          </ol>
        </section>

        <section className="card" aria-labelledby="foco">
          <div className="card-head">
            <h2 id="foco" className="section-title">
              Onde estão os pontos da prova
            </h2>
            <Link href="/app/evolucao" className="muted" style={{ fontSize: 13.5 }}>
              Ver evolução
            </Link>
          </div>
          <p className="muted" style={{ fontSize: 14, margin: "4px 0 12px" }}>
            {stage === "novo"
              ? "Quanto cada área vale na prova. Conforme você responde, aparece o seu acerto em cada uma, e o plano reforça as mais fracas."
              : "Peso de cada área na prova e o seu acerto nela. O plano do dia reforça as áreas marcadas como foco."}
          </p>
          <ul className="focus-list">
            {areas.map((area) => (
              <li key={area.id}>
                <span className="focus-dot" style={{ background: area.color }} aria-hidden />
                <span className="focus-name">
                  {area.name}
                  {weak.has(area.id) && <span className="focus-tag">Foco</span>}
                </span>
                <span className="focus-share" aria-label={`Peso ${Math.round(area.share * 100)}%`}>
                  <span className="bar" aria-hidden>
                    <i style={{ width: `${(area.share / maxShare) * 100}%`, background: area.color }} />
                  </span>
                  {Math.round(area.share * 100)}%
                </span>
                <span className={`focus-pct${area.pct === null ? " is-empty" : ""}`}>
                  {area.pct === null ? (area.n > 0 ? `${area.n} resp.` : "—") : `${Math.round(area.pct)}%`}
                </span>
              </li>
            ))}
          </ul>
          <p className="dim focus-legend">
            <span>Barra: peso na prova</span>
            <span>À direita: seu acerto</span>
          </p>
        </section>

        <section aria-labelledby="atalhos">
          <h2 id="atalhos" className="section-title">
            Ferramentas de estudo
          </h2>
          <ul className="shortcut-grid">
            {[
              { href: "/app/plantao", icon: "plantao" as const, title: "Plantão do Dia", text: "10 questões iguais para todos, todo dia. Sempre grátis.", paid: false },
              { href: "/app/revisao", icon: "revisao" as const, title: "Revisão", text: due > 0 ? `${due} ${due === 1 ? "questão voltou" : "questões voltaram"} para você.` : "O que você errar volta na hora certa.", paid: true },
              { href: "/app/treino", icon: "treino" as const, title: "Treino", text: "Filtre por área, tema, prova e dificuldade.", paid: true },
              { href: "/app/simulados", icon: "simulados" as const, title: "Simulados", text: "Prova completa com tempo, como no dia.", paid: true },
              { href: "/app/provas", icon: "provas" as const, title: "Provas oficiais", text: "Questões de edições anteriores, com gabarito.", paid: false },
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

        {firstStepsDone < firstSteps.length && (
          <section className="card" aria-labelledby="primeiros-passos">
            <div className="card-head">
              <h3 id="primeiros-passos" className="aside-title">
                Primeiros passos
              </h3>
              <span className="muted">
                {firstStepsDone} de {firstSteps.length}
              </span>
            </div>
            <div className="bar level" style={{ margin: "10px 0 12px" }} aria-hidden>
              <i style={{ width: `${(firstStepsDone / firstSteps.length) * 100}%` }} />
            </div>
            <ul className="first-steps">
              {firstSteps.map((s) => (
                <li key={s.title} className={s.done ? "is-done" : undefined}>
                  <span className="first-steps-mark" aria-hidden>
                    {s.done ? "✓" : ""}
                  </span>
                  <span>
                    {s.done ? (
                      <strong>{s.title}</strong>
                    ) : (
                      <Link href={s.href}>
                        <strong>{s.title}</strong>
                      </Link>
                    )}
                    <small>{s.done ? "Feito" : s.text}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {goals.set && (
          <section className="card" aria-labelledby="reta">
            <div className="card-head">
              <h3 id="reta" className="aside-title">
                Caminho até a prova
              </h3>
              <span className="muted">{EXAM_LABEL[goals.targetExam]}</span>
            </div>
            {dayPlan.phase && goals.examDate ? (
              <>
                <p className="path-days">
                  <strong>{dayPlan.daysLeft}</strong> {dayPlan.daysLeft === 1 ? "dia" : "dias"}
                  <small>até {examMonth(goals.examDate)}</small>
                </p>
                <ol className="path-phases">
                  {PHASES.map((phase, i) => (
                    <li key={phase.key} className={i < phaseIndex ? "is-past" : i === phaseIndex ? "is-now" : undefined}>
                      <strong>{phase.name}</strong>
                      {i === phaseIndex && <small>{phase.text}</small>}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>
                Sem data de prova, o plano fica na fase de base. <Link href="/comecar">Informe o mês</Link> quando o edital sair.
              </p>
            )}
          </section>
        )}

        {stage !== "novo" && (
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
              <LevelBar label={`Nível: ${level.current.name}`} value={`${rating.data.xp_total} XP`} progress={level.progress} />
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
                <LevelBar label={nextAchievement.name} value={`${nextAchievement.current} de ${nextAchievement.goal}`} progress={nextAchievement.pct} />
                <Link href="/app/evolucao" style={{ fontSize: 14 }}>
                  Ver todas as conquistas
                </Link>
              </section>
            )}
          </>
        )}

        {missions.length > 0 && (
          <section className="card" aria-labelledby="missoes">
            <div className="card-head">
              <h3 id="missoes" className="aside-title">
                Missões do dia
              </h3>
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

        <p style={{ fontSize: 14.5 }}>
          <Link href="/app/como-funciona">Como funciona o EnaQuest</Link>
        </p>
      </aside>
    </div>
  );
}
