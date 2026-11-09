import type { Metadata } from "next";
import Link from "next/link";
import { Emblem } from "@/components/Emblem";
import { admin } from "@/lib/supabase/admin";
import { PLACEMENT_GAMES, tierOf } from "@/lib/game/rating";
import { Flame, ShieldDots } from "@/components/Flame";
import { achievementProgress, closestAchievements } from "@/lib/game/progress";
import { displayedStreak, MAX_SHIELDS, todayBR } from "@/lib/game/streak";
import { getDailyBoard, getDailyState } from "@/lib/server/daily";
import { lifetimeStats, todayMissions, weekActivity } from "@/lib/server/progress";
import { getProfile, isPremium, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Hoje" };

const WEEKDAY = ["D", "S", "T", "Q", "Q", "S", "S"];

export default async function TodayPage() {
  const user = await requireUser();
  const day = todayBR();
  const [profile, premium, daily, board, missions, rating, due, streak, week, stats, owned] = await Promise.all([
    getProfile(user.id),
    isPremium(user.id),
    getDailyState(user.id, day),
    getDailyBoard(user.id, day),
    todayMissions(user.id),
    admin().from("rating_state").select("rating, games, peak").eq("user_id", user.id).single(),
    admin().from("srs_cards").select("question_id", { count: "exact", head: true }).eq("user_id", user.id).lte("due", new Date().toISOString()),
    admin().from("streaks").select("current, best, last_active, shields").eq("user_id", user.id).single(),
    weekActivity(user.id),
    lifetimeStats(user.id),
    admin().from("achievements").select("achievement_id").eq("user_id", user.id),
  ]);

  const shownStreak = displayedStreak(streak.data, day);
  const activeToday = streak.data.last_active === day;
  const nearAchievements = closestAchievements(
    achievementProgress(stats, new Set((owned.data ?? []).map((a: { achievement_id: string }) => a.achievement_id))),
    3,
  );

  const value = Number(rating.data.rating);
  const inPlacement = rating.data.games < PLACEMENT_GAMES;
  const { tier, next } = tierOf(value);
  const answered = Object.keys(daily.answered).length;
  const hits = Object.values(daily.answered).filter((a) => a.correct).length;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <p className="muted" style={{ fontSize: 14 }}>
          Bom plantão, {profile.nickname}
        </p>
      </div>

      <section className="card" style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
        <p className="eyebrow">Plantão do Dia</p>
        {daily.questions.length === 0 ? (
          <>
            <h1 style={{ fontSize: 26, marginTop: 4 }}>O plantão de hoje ainda não foi escalado</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              Ainda não há questões publicadas. Assim que o primeiro lote for aprovado, elas aparecem aqui.
            </p>
          </>
        ) : daily.done ? (
          <>
            <h1 style={{ fontSize: 28, marginTop: 4 }}>
              Concluído: {hits}/{daily.questions.length}
            </h1>
            <p className="muted" style={{ marginTop: 6 }}>
              {board.percentile !== null
                ? `Você foi melhor que ${board.percentile}% de quem já fez hoje.`
                : "Volte amanhã para manter a sequência. Novas questões à meia-noite."}
            </p>
            <Link href="/app/plantao" className="btn btn-ghost" style={{ marginTop: 12 }}>
              Rever questões
            </Link>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 28, marginTop: 4 }}>{answered ? `Faltam ${daily.questions.length - answered} questões` : `${daily.questions.length} questões, as mesmas para todo mundo`}</h1>
            <Link href="/app/plantao" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }}>
              {answered ? "Continuar plantão" : "Começar plantão"}
            </Link>
          </>
        )}
      </section>

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Flame lit={activeToday && shownStreak > 0} size={38} />
            <div>
              <div className="display" style={{ fontSize: 28 }}>
                {shownStreak} {shownStreak === 1 ? "dia seguido" : "dias seguidos"}
              </div>
              <p className="muted" style={{ fontSize: 13.5 }}>
                {activeToday ? "Sequência garantida hoje." : shownStreak > 0 ? "Responda uma questão hoje para mantê-la." : "Responda uma questão para acender a chama."}
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p className="eyebrow" style={{ marginBottom: 2 }}>
              Trocas de plantão
            </p>
            <ShieldDots count={streak.data.shields} max={MAX_SHIELDS} />
            <p className="dim" style={{ fontSize: 12.5 }}>
              Ganhe uma a cada 7 dias
            </p>
          </div>
        </div>
        <ul className="week-dots" style={{ marginTop: 12 }} aria-label="Atividade dos últimos 7 dias">
          {week.map((item) => (
            <li key={item.day} className={`${item.active ? "on" : ""} ${item.day === day ? "today" : ""}`}>
              <i aria-label={item.active ? "Estudou" : "Sem estudo"} role="img" />
              {WEEKDAY[new Date(`${item.day}T12:00:00Z`).getUTCDay()]}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid-2">
        <section className="card" style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Emblem rating={value} placement={inPlacement} size={58} />
          <div>
            <p className="eyebrow">{inPlacement ? "Nivelamento" : "Sua patente"}</p>
            <div className="display" style={{ fontSize: 22 }}>
              {inPlacement ? `Faltam ${PLACEMENT_GAMES - rating.data.games} questões` : tier.name}
            </div>
            {!inPlacement && (
              <p className="muted" style={{ fontSize: 14 }}>
                Rating {Math.round(value)}
                {next ? `. Faltam ${Math.ceil(next.min - value)} para ${next.name}` : ""}
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            Missões de hoje
          </p>
          <ul style={{ display: "grid", gap: 7 }}>
            {missions.map((mission) => (
              <li key={mission.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14.5 }}>
                <span style={mission.done ? { textDecoration: "line-through", color: "var(--dim)" } : undefined}>
                  {mission.done ? "✓ " : ""}
                  {mission.text}
                </span>
                <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {mission.current}/{mission.goal}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {nearAchievements.length > 0 && (
        <section className="card">
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            Conquistas perto de sair
          </p>
          <ul style={{ display: "grid", gap: 12 }}>
            {nearAchievements.map((achievement) => (
              <li key={achievement.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14.5 }}>
                  <span>
                    <strong>{achievement.name}</strong> <span className="dim">· {achievement.description}</span>
                  </span>
                  <span className="muted" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {achievement.current}/{achievement.goal}
                  </span>
                </div>
                <div className="bar achv-bar" role="progressbar" aria-label={achievement.name} aria-valuenow={Math.round(achievement.pct * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <i style={{ width: `${achievement.pct * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(due.count ?? 0) > 0 && (
        <Link href="/app/revisao" className="card" style={{ textDecoration: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <p className="eyebrow">Revisão</p>
            <strong>{due.count} questões voltaram para você hoje</strong>
          </div>
          <span aria-hidden>→</span>
        </Link>
      )}

      {!premium && (
        <section className="card">
          <h2 style={{ fontSize: 20 }}>Quer ir além do plantão?</h2>
          <p className="muted" style={{ margin: "6px 0 12px", fontSize: 15 }}>
            Treino por área, revisão espaçada, simulados e Termômetro de Proficiência por R$ 29 por mês.
          </p>
          <Link href="/planos" className="btn btn-ghost">
            Ver assinatura
          </Link>
        </section>
      )}

      {board.rows.length > 0 && (
        <section className="card">
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            Ranking de hoje · {board.total} {board.total === 1 ? "pessoa concluiu" : "pessoas concluíram"}
          </p>
          <div className="rows" style={{ gap: 2 }}>
            {board.rows.slice(0, 10).map((row, i) => (
              <div key={row.nickname} className={`row-board ${row.me ? "me" : ""}`}>
                <span className="display">{i + 1}</span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.nickname}
                  {row.school && <span className="dim"> · {row.school}</span>}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {row.correct}/{daily.questions.length} · {row.minutes} min
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
