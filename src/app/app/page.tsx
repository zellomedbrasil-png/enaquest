import type { Metadata } from "next";
import Link from "next/link";
import { Emblem } from "@/components/Emblem";
import { Flame } from "@/components/Flame";
import { MyMascot } from "@/components/MyMascot";
import { StatusPill } from "@/components/ui";
import { admin } from "@/lib/supabase/admin";
import { buildJourney, journeyStage, type JourneyStep, type StepState } from "@/lib/game/journey";
import { PLACEMENT_GAMES, tierOf } from "@/lib/game/rating";
import { displayedStreak, todayBR } from "@/lib/game/streak";
import { levelOf } from "@/lib/game/xp";
import { getDailyState } from "@/lib/server/daily";
import { countDueReviews, reviewAgenda } from "@/lib/server/study";
import { getDayView } from "@/lib/server/day-plan";
import { firstNameOf } from "@/lib/server/onboarding";
import { StudyGoalsForm } from "@/components/StudyGoalsForm";
import { todayMissions, weekActivity } from "@/lib/server/progress";
import { getProfile, isPremium, requireUser } from "@/lib/server/session";
import type { DayPhase } from "@/lib/study/day-plan";
import { questionsFor } from "@/lib/study/onboarding";

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

/** Ícones de linha das ferramentas, no traço do menu lateral. */
const ICON = {
  plantao: "M3 12h4l3-8 4 16 3-8h4",
  revisao: "M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15m0 5v-5h5",
  treino: "M4 19V9m5 10V5m6 14v-7m5 7V8",
  simulados: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  provas: "M6 3h8l5 5v13H6V3Zm8 0v5h5M9.5 14.5l2 2 4-4",
  evolucao: "M3 17l6-6 4 4 8-9",
  ligas: "M7 4h10v5a5 5 0 0 1-10 0V4Zm5 10v4m-4 3h8M7 6H4a3 3 0 0 0 3 3m10-3h3a3 3 0 0 1-3 3",
  percurso: "M4 20h4l10-10-4-4L4 16v4ZM13 7l4 4",
  metodo: "M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4V5Zm16 0h-4a3 3 0 0 0-3 3",
  mascote: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM9 11h.01M15 11h.01M9 15c1.5 1 4.5 1 6 0",
  conta: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  ajuda: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14m0 3h.01",
  planos: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9L12 3Z",
  check: "m5 12 5 5L20 7",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6v-9Z",
} as const;

function Svg({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

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

function hourBR(): number {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date()));
}

function examMonth(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function Meter({ label, color, done, target, unit }: { label: string; color: string; done: number; target: number; unit?: string }) {
  const pct = target > 0 ? Math.min(1, done / target) : 0;
  return (
    <div className="goal-meter">
      <span className="goal-meter-label">
        <i style={{ background: color }} aria-hidden />
        {label}
      </span>
      <strong>
        {done}
        <small>
          /{target}
          {unit ? ` ${unit}` : ""}
        </small>
      </strong>
      <span className="bar" aria-hidden>
        <i style={{ width: `${pct * 100}%`, background: color }} />
      </span>
    </div>
  );
}

export default async function TodayPage() {
  const user = await requireUser();
  const day = todayBR();
  const since = `${day}T03:00:00Z`;
  // Últimos 7 dias contando hoje, no fuso do Brasil.
  const weekAgo = new Date(Date.parse(since) - 6 * 86_400_000).toISOString();
  const db = admin();
  const [profile, premium, daily, missions, rating, due, streak, week, answeredCount, agenda, dayView, todayRows, weekRows] = await Promise.all([
    getProfile(user.id),
    isPremium(user.id),
    getDailyState(user.id, day),
    todayMissions(user.id),
    db.from("rating_state").select("rating, games, xp_total").eq("user_id", user.id).single(),
    countDueReviews(user.id),
    db.from("streaks").select("current, best, last_active, shields").eq("user_id", user.id).single(),
    weekActivity(user.id),
    db.from("answers").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    reviewAgenda(user.id),
    getDayView(user.id),
    db.from("answers").select("ms, mode, is_correct").eq("user_id", user.id).gte("created_at", since),
    db.from("answers").select("is_correct").eq("user_id", user.id).gte("created_at", weekAgo),
  ]);
  const dayPlan = dayView.plan;
  const goals = dayView.goals;
  const name = firstNameOf(user) ?? profile.nickname;

  const totalAnswered = answeredCount.count ?? 0;
  const stage = journeyStage({ answered: totalAnswered, ratedGames: rating.data.games });
  const answered = Object.keys(daily.answered).length;
  const dailyTotal = daily.questions.length;
  const hits = Object.values(daily.answered).filter((a) => a.correct).length;
  const extra = missions.filter((m) => m.id !== "m_daily");
  const journey = buildJourney({
    premium,
    dailyTotal,
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
  const { tier } = tierOf(value);
  const level = levelOf(rating.data.xp_total);
  const inPlacement = rating.data.games < PLACEMENT_GAMES;

  // Metas do dia: o que o plano pede e o que já foi feito hoje.
  const todayList = (todayRows.data ?? []) as { ms: number | null; mode: string; is_correct: boolean }[];
  // Mesma conta da barra do topo: no plano grátis, a meta é o Plantão; na assinatura, o tempo do dia.
  const questionsTarget = premium ? Math.max(dailyTotal, questionsFor(dayPlan.minutes)) : dailyTotal;
  const hitsToday = todayList.filter((r) => r.is_correct).length;
  const minutesDone = Math.round(todayList.reduce((sum, r) => sum + (r.ms ?? 0), 0) / 60_000);
  const reviewBlock = dayPlan.blocks.find((b) => b.kind === "revisao");
  const reviewsDone = todayList.filter((r) => r.mode === "review").length;
  const goalPct = Math.round(
    (Math.min(1, todayList.length / Math.max(1, questionsTarget)) + Math.min(1, minutesDone / Math.max(1, dayPlan.minutes))) * 50,
  );

  // Desempenho da semana.
  const weekList = (weekRows.data ?? []) as { is_correct: boolean }[];
  const weekHits = weekList.filter((r) => r.is_correct).length;
  const weekPct = weekList.length ? Math.round((weekHits / weekList.length) * 100) : null;
  const activeDays = week.filter((w) => w.active).length;

  // Saudação pela hora do Brasil.
  const hour = hourBR();
  const period = hour >= 5 && hour < 12 ? "manha" : hour >= 12 && hour < 18 ? "tarde" : "noite";
  const greeting = { manha: "Bom dia", tarde: "Boa tarde", noite: "Boa noite" }[period];

  // Próximo passo: o Plantão pela metade vira "você parou na questão X".
  const midPlantao = answered > 0 && answered < dailyTotal;
  const next = midPlantao
    ? {
        title: `Você parou na questão ${answered + 1} de ${dailyTotal}`,
        text: "O Plantão continua de onde você deixou, com o comentário de cada questão.",
        cta: "Continuar meu plantão",
        href: "/app/plantao",
      }
    : { title: journey.next.title, text: journey.next.text, cta: journey.next.cta, href: journey.next.href };

  const firstSteps = [
    { done: goals.set, title: "Montar seu percurso", text: "Prova, tempo por dia e mês da prova.", href: "/comecar" },
    { done: totalAnswered > 0, title: "Responder a primeira questão", text: "O Plantão de hoje já está pronto.", href: "/app/plantao" },
    { done: !inPlacement, title: "Calibrar seu nível", text: `${Math.min(rating.data.games, PLACEMENT_GAMES)} de ${PLACEMENT_GAMES} questões. Depois vem sua patente.`, href: "/app/plantao" },
    { done: shownStreak >= 3 || (streak.data.best ?? 0) >= 3, title: "Estudar 3 dias seguidos", text: "A sequência ganha uma troca de plantão a cada 7 dias.", href: "/app/plantao" },
  ];
  const firstStepsDone = firstSteps.filter((s) => s.done).length;

  const areas = [...dayView.areas].sort((a, b) => b.share - a.share);
  const maxShare = Math.max(...areas.map((a) => a.share), 0.01);
  const weak = new Set(dayPlan.weakAreas);
  const phaseIndex = PHASES.findIndex((p) => p.key === dayPlan.phase);

  const access = [
    { icon: ICON.plantao, title: "Plantão do Dia", detail: "grátis todo dia", value: `${answered}/${dailyTotal}`, pct: dailyTotal ? answered / dailyTotal : 0, open: true, href: "/app/plantao" },
    { icon: ICON.revisao, title: "Revisão", detail: premium ? "para hoje" : "na assinatura", value: premium ? String(due) : due > 0 ? `${due} esperando` : "—", pct: premium ? 1 : 0, open: premium, href: "/app/revisao" },
    { icon: ICON.treino, title: "Treino e simulados", detail: premium ? "liberados" : "na assinatura", value: premium ? "Livre" : "—", pct: premium ? 1 : 0, open: premium, href: "/app/treino" },
  ];

  const toolGroups: { title: string; items: { href: string; icon: keyof typeof ICON; color: string; title: string; text: string; paid?: boolean; tag?: string }[] }[] = [
    {
      title: "Estudar e revisar",
      items: [
        { href: "/app/plantao", icon: "plantao", color: "var(--lime)", title: "Plantão do Dia", text: "10 questões iguais para todos, sempre grátis" },
        { href: "/app/treino", icon: "treino", color: "var(--sky)", title: "Treino", text: "Por área, tema, prova e dificuldade", paid: true },
        { href: "/app/revisao", icon: "revisao", color: "var(--coral)", title: "Revisão e caderno de erros", text: due > 0 ? `${due} ${due === 1 ? "questão voltou" : "questões voltaram"} para você` : "O que você errar volta na hora certa", paid: true },
        { href: "/app/provas", icon: "provas", color: "var(--gold)", title: "Provas oficiais", text: "Edições anteriores, com gabarito" },
      ],
    },
    {
      title: "Planejar e simular",
      items: [
        { href: "/comecar", icon: "percurso", color: "var(--prev)", title: "Meu percurso", text: goals.set ? "Ajuste prova, ritmo e prazo" : "Monte em 1 minuto", tag: goals.set ? undefined : "Novo" },
        { href: "/app/simulados", icon: "simulados", color: "var(--go)", title: "Simulados", text: "Prova completa com tempo, como no dia", paid: true },
        { href: "/metodo", icon: "metodo", color: "var(--cir)", title: "Método EnaQuest", text: "Como o plano escolhe o que estudar" },
      ],
    },
    {
      title: "Desempenho e desafios",
      items: [
        { href: "/app/evolucao", icon: "evolucao", color: "var(--ok)", title: "Evolução e conquistas", text: "Acerto por área e marcos da jornada" },
        { href: "/app/ligas", icon: "ligas", color: "var(--gold)", title: "Ligas e turmas", text: "Ranking da semana com a sua turma" },
        { href: "/app/mascote", icon: "mascote", color: "var(--sky)", title: "Mascote", text: "Escolha quem faz plantão com você" },
      ],
    },
    {
      title: "Conta e ajuda",
      items: [
        { href: "/app/conta", icon: "conta", color: "var(--mute)", title: "Conta", text: "Perfil, faculdade e assinatura" },
        { href: "/app/como-funciona", icon: "ajuda", color: "var(--mute)", title: "Como funciona", text: "Rating, sequência, ligas e revisão" },
        ...(!premium ? [{ href: "/planos", icon: "planos" as const, color: "var(--lime)", title: "Assinatura", text: "Treino, revisão e simulados por R$ 29/mês" }] : []),
      ],
    },
  ];

  return (
    <div className="home">
      <section className="access-card" aria-labelledby="acesso">
        <div className="access-head">
          <span className="access-badge" aria-hidden>
            <Svg d={premium ? ICON.planos : ICON.plantao} />
          </span>
          <div>
            <h2 id="acesso">{premium ? "Assinatura ativa" : "Plano grátis"}</h2>
            <p>{premium ? "Tudo liberado. O Plantão do Dia renova à meia-noite." : "O Plantão do Dia renova à meia-noite."}</p>
          </div>
          <Link href={premium ? "/app/conta" : "/planos"} className={premium ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}>
            {premium ? "Minha assinatura" : "Ver planos"}
          </Link>
        </div>
        <ul className="access-list">
          {access.map((item) => (
            <li key={item.title}>
              <Link href={item.href} className={item.open ? undefined : "is-locked"}>
                <Svg d={item.open ? item.icon : ICON.lock} />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                <b>{item.value}</b>
                <span className="bar" aria-hidden>
                  <i style={{ width: `${item.pct * 100}%` }} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={`resume-card${journey.next.allDone && !midPlantao ? " is-done" : ""}`} aria-labelledby="proximo">
        <span className="resume-mascot" aria-hidden>
          <MyMascot mood={journey.next.allDone ? "feliz" : !activeToday && shownStreak > 0 ? "preocupado" : "neutro"} size={64} />
        </span>
        <div className="resume-text">
          <ol className="resume-steps" aria-label="Passos de hoje">
            {journey.steps.slice(0, 3).map((step, i) => (
              <li key={step.id} className={`is-${step.state}`}>
                <span aria-hidden>{step.state === "done" ? "✓" : i + 1}</span>
                {step.title}
              </li>
            ))}
          </ol>
          <h2 id="proximo">{next.title}</h2>
          <p>{next.text}</p>
        </div>
        <div className="resume-actions">
          {next.cta && next.href && (
            <Link href={next.href} className="btn btn-primary">
              {next.cta} →
            </Link>
          )}
          <Link href={goals.set ? "#seu-dia" : "/comecar"} className="btn btn-ghost">
            {goals.set ? "Ver meu dia" : "Montar meu percurso"}
          </Link>
        </div>
      </section>

      <section className={`greet greet-${period}`} aria-labelledby="ola">
        <div className="greet-sky" aria-hidden>
          {period === "noite" ? (
            <>
              <i className="greet-moon" />
              <i className="greet-star" style={{ left: "52%", top: "22%" }} />
              <i className="greet-star" style={{ left: "64%", top: "58%" }} />
              <i className="greet-star" style={{ left: "78%", top: "18%" }} />
              <i className="greet-star" style={{ left: "45%", top: "64%" }} />
            </>
          ) : (
            <i className="greet-sun" />
          )}
          <i className="greet-hill" />
        </div>
        <h1 id="ola">
          {greeting}, {name}!
        </h1>
        <Link href="/app/evolucao" className="greet-streak">
          <Flame lit={activeToday && shownStreak > 0} size={30} />
          <strong>{shownStreak}</strong>
          <span>
            {shownStreak === 1 ? "dia de sequência" : "dias de sequência"}
            <small>Recorde: {Math.max(streak.data.best ?? 0, shownStreak)} {Math.max(streak.data.best ?? 0, shownStreak) === 1 ? "dia" : "dias"}</small>
          </span>
          <span aria-hidden className="greet-arrow">
            ›
          </span>
        </Link>
      </section>

      <div className="home-row">
        <section className="card home-card" id="seu-dia" aria-labelledby="estudo-hoje">
          <div className="home-card-head">
            <h2 id="estudo-hoje">Seu estudo de hoje</h2>
            {!goals.set && (
              <Link href="/comecar" className="btn btn-ghost btn-sm">
                Ajustar rotina
              </Link>
            )}
          </div>
          {goals.set && <StudyGoalsForm initial={goals} today={day} compact />}
          {dayPlan.plannedMinutes > dayPlan.minutes && (
            <p className="dim" style={{ fontSize: 13.5 }}>
              O Plantão sozinho já passa do seu tempo de hoje. O resto entra quando você tiver mais minutos.
            </p>
          )}
          <ol className="journey">
            {journey.steps.map((step, i) => (
              <Step key={step.id} step={step} index={i} />
            ))}
          </ol>
        </section>

        <section className="card home-card" aria-labelledby="semana">
          <div className="home-card-head">
            <h2 id="semana">Seu progresso na semana</h2>
            <span className="week-count">
              <strong>{activeDays}/7</strong> dias ativos
            </span>
          </div>
          <ul className="week-strip" aria-label="Atividade dos últimos 7 dias">
            {week.map((item) => (
              <li key={item.day} className={`${item.active ? "is-on" : ""}${item.day === day ? " is-today" : ""}`}>
                <span>{WEEKDAY[new Date(`${item.day}T12:00:00Z`).getUTCDay()]}</span>
                <i aria-hidden>{item.active ? "✓" : ""}</i>
                <span className="sr-only">{item.active ? "estudou" : "sem estudo"}</span>
              </li>
            ))}
          </ul>
          <div className="week-level">
            <Emblem rating={value} placement={inPlacement} size={42} />
            <div className="week-level-text">
              <p>
                <strong>{inPlacement ? "Nivelamento" : `Patente ${tier.name}`}</strong>
                <span>{inPlacement ? `${rating.data.games} de ${PLACEMENT_GAMES}` : `${level.current.name} · ${rating.data.xp_total} XP`}</span>
              </p>
              <span className="bar level" aria-hidden>
                <i style={{ width: `${(inPlacement ? rating.data.games / PLACEMENT_GAMES : level.progress) * 100}%` }} />
              </span>
              <p className="dim" style={{ fontSize: 12.5 }}>
                {inPlacement ? "Ao terminar, você recebe sua patente. Até lá, errar tira poucos pontos." : level.next ? `Faltam ${level.toNext} XP para ${level.next.name}.` : "Nível máximo."}
              </p>
            </div>
          </div>
          {premium && (
            <Link href="/app/revisao" className="week-agenda">
              <span>
                <strong>{agenda[0].count}</strong> revisões hoje
              </span>
              <span>
                <strong>{agenda[1].count}</strong> amanhã
              </span>
              <span>
                <strong>{agenda.reduce((sum, entry) => sum + entry.count, 0)}</strong> na semana
              </span>
            </Link>
          )}
        </section>
      </div>

      <section className="card goals-card" aria-labelledby="metas">
        <div className="goals-today">
          <div className="home-card-head">
            <h2 id="metas">Metas do dia</h2>
            <span className="goals-ring" style={{ ["--pct" as string]: `${goalPct}%` }} aria-label={`${goalPct}% da meta`}>
              {goalPct}%
            </span>
          </div>
          <div className="goals-meters">
            <Meter label="Questões" color="var(--sky)" done={todayList.length} target={questionsTarget} />
            <Meter label="Tempo" color="var(--ok)" done={minutesDone} target={dayPlan.minutes} unit="min" />
            {premium ? (
              <Meter label="Revisões" color="var(--go)" done={reviewsDone} target={reviewBlock?.target ?? 0} />
            ) : (
              <Meter label="Acertos" color="var(--go)" done={hitsToday} target={todayList.length} />
            )}
          </div>
        </div>
        <div className="goals-week">
          <h3>Desempenho da semana</h3>
          {weekPct === null ? (
            <>
              <p className="muted">Responda questões nesta semana para acompanhar seus acertos aqui.</p>
              <Link href="/app/plantao" className="btn btn-ghost btn-sm">
                Praticar questões →
              </Link>
            </>
          ) : (
            <>
              <p className="goals-week-pct">
                <strong>{weekPct}%</strong> de acerto
              </p>
              <span className="bar" aria-hidden>
                <i style={{ width: `${weekPct}%` }} />
              </span>
              <p className="dim" style={{ fontSize: 13 }}>
                {weekHits} certas em {weekList.length} {weekList.length === 1 ? "questão" : "questões"} nos últimos 7 dias.
              </p>
            </>
          )}
        </div>
      </section>

      <div className="home-row">
        <section className="card home-card" aria-labelledby="caminho">
          <div className="home-card-head">
            <h2 id="caminho">Caminho até a prova</h2>
            {goals.set && <span className="muted">{EXAM_LABEL[goals.targetExam]}</span>}
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
            <div className="home-empty">
              <Svg d={ICON.percurso} />
              <p>
                {goals.set ? "Sem data de prova, o plano fica na fase de base." : "Seu percurso ainda não foi montado."}
                <small>Com o mês da prova, o plano passa por base, consolidação e reta final.</small>
              </p>
              <Link href="/comecar" className="btn btn-ghost btn-sm">
                {goals.set ? "Informar o mês" : "Montar percurso"}
              </Link>
            </div>
          )}
        </section>

        {firstStepsDone < firstSteps.length ? (
          <section className="card home-card" aria-labelledby="primeiros-passos">
            <div className="home-card-head">
              <h2 id="primeiros-passos">Primeiros passos</h2>
              <span className="muted">
                {firstStepsDone} de {firstSteps.length}
              </span>
            </div>
            <div className="bar level" aria-hidden>
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
        ) : (
          <section className="card home-card" aria-labelledby="missoes">
            <div className="home-card-head">
              <h2 id="missoes">Missões do dia</h2>
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
      </div>

      <section className="card" aria-labelledby="foco">
        <div className="home-card-head">
          <h2 id="foco">Onde estão os pontos da prova</h2>
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

      <section aria-labelledby="ferramentas" className="tools">
        <h2 id="ferramentas" className="section-title">
          Ferramentas
        </h2>
        <div className="tools-card">
          {toolGroups.map((group) => (
            <div key={group.title} className="tools-group">
              <h3>
                {group.title} <small>{group.items.length}</small>
              </h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="tool">
                      <span className="tool-icon" style={{ color: item.color, background: `color-mix(in srgb, ${item.color} 16%, transparent)` }}>
                        <Svg d={ICON[item.icon]} />
                      </span>
                      <span className="tool-text">
                        <strong>
                          {item.title}
                          {item.paid && !premium && <span className="tool-tag">Assinatura</span>}
                          {item.tag && <span className="tool-tag is-new">{item.tag}</span>}
                        </strong>
                        <small>{item.text}</small>
                      </span>
                      <span className="tool-arrow" aria-hidden>
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
