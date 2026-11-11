import type { Metadata } from "next";
import Link from "next/link";
import { createGroupAction, joinGroupAction, leaveGroupAction } from "@/app/actions";
import { Emblem } from "@/components/Emblem";
import { PageHeader } from "@/components/ui";
import { admin } from "@/lib/supabase/admin";
import { journeyStage } from "@/lib/game/journey";
import { PLACEMENT_GAMES, TIERS } from "@/lib/game/rating";
import { todayBR } from "@/lib/game/streak";
import { addDays } from "@/lib/study/agenda";
import { DAILY_SIZE, getDailyBoard } from "@/lib/server/daily";
import { getLeagueView, LEAGUE_NAMES, type BoardRow } from "@/lib/server/leagues";
import { getProfile, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Ligas" };

/** Rating mínimo de cada liga, só para desenhar o escudo na cor certa. */
const tierRating = (tier: number) => TIERS[Math.max(0, Math.min(TIERS.length - 1, tier))].min;

function Board({ rows, promoteUntil = 0, demoteFrom = null }: { rows: BoardRow[]; promoteUntil?: number; demoteFrom?: number | null }) {
  return (
    <ol className="league-board">
      {rows.map((row) => {
        const zone = row.position <= promoteUntil ? "up" : demoteFrom !== null && row.position >= demoteFrom ? "down" : "safe";
        return (
          <li key={row.position} className={`league-row is-${zone} ${row.me ? "is-me" : ""}`}>
            <span className="league-pos">{row.position}</span>
            <span className="league-name">
              {row.nickname}
              {row.me && <span className="league-you">você</span>}
            </span>
            {zone === "up" && <span className="league-zone up">Sobe</span>}
            {zone === "down" && <span className="league-zone down">Desce</span>}
            <span className="league-xp">{row.xp} XP</span>
          </li>
        );
      })}
    </ol>
  );
}

const PODIUM_ORDER = [1, 0, 2];

export default async function LeaguesPage() {
  const user = await requireUser();
  const [view, profile, board, rating, answered] = await Promise.all([
    getLeagueView(user.id),
    getProfile(user.id),
    getDailyBoard(user.id, todayBR()),
    admin().from("rating_state").select("games").eq("user_id", user.id).single(),
    admin().from("answers").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const stage = journeyStage({ answered: answered.count ?? 0, ratedGames: rating.data.games });
  const locked = stage !== "ativo";
  const games = Number(rating.data.games);
  const left = Math.max(0, PLACEMENT_GAMES - games);

  // A semana da liga vai de segunda a domingo.
  const today = todayBR();
  let daysLeft = 7;
  for (let i = 0; i < 7; i++) if (addDays(view.week, i) === today) daysLeft = 7 - i;
  const me = view.table.find((row) => row.me);
  const zone = me ? (me.position <= view.promoteUntil ? "up" : view.demoteFrom !== null && me.position >= view.demoteFrom ? "down" : "safe") : null;
  const zoneText = { up: "Zona de subida", safe: "Zona segura", down: "Zona de queda" } as const;
  const topSchoolXp = Math.max(1, ...view.schools.map((school) => school.avgXp));
  const podium = board.rows.slice(0, 3);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader title="Ligas" lead="Ganhe XP de segunda a domingo para subir de liga. Toda semana recomeça do zero." />

      <section className={`card league-hero ${locked ? "is-locked" : ""}`} aria-labelledby="liga-atual">
        <div className="league-hero-main">
          <Emblem rating={tierRating(locked ? 0 : view.tier)} placement={locked} size={72} />
          <div className="league-hero-text">
            {locked ? (
              <>
                <p className="eyebrow">Liga semanal</p>
                <h2 id="liga-atual">A liga semanal abre depois do nivelamento</h2>
                <p className="muted">
                  Faltam {left} {left === 1 ? "questão" : "questões"} para calibrar seu rating. Enquanto isso, você já pode criar ou entrar em uma turma.
                </p>
                <div className="league-hero-progress">
                  <div className="bar level" role="progressbar" aria-label="Nivelamento" aria-valuenow={games} aria-valuemin={0} aria-valuemax={PLACEMENT_GAMES}>
                    <i style={{ width: `${Math.min(1, games / PLACEMENT_GAMES) * 100}%` }} />
                  </div>
                  <span>
                    {Math.min(games, PLACEMENT_GAMES)} de {PLACEMENT_GAMES}
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">Sua liga desta semana</p>
                <h2 id="liga-atual">Liga {view.tierName}</h2>
                <p className="muted">
                  Termina no domingo. {daysLeft === 1 ? "Último dia" : `Faltam ${daysLeft} dias`} para subir.
                </p>
              </>
            )}
          </div>
          {locked ? (
            <Link href="/app" className="btn btn-primary league-hero-cta">
              Ir para Hoje
            </Link>
          ) : (
            <dl className="league-hero-stats">
              <div>
                <dt>Posição</dt>
                <dd>{me ? `${me.position}º de ${view.table.length}` : "–"}</dd>
              </div>
              <div>
                <dt>XP na semana</dt>
                <dd>{me?.xp ?? 0}</dd>
              </div>
              <div>
                <dt>Situação</dt>
                <dd className={zone ? `zone-${zone}` : undefined}>{zone ? zoneText[zone] : "Fora do grupo"}</dd>
              </div>
            </dl>
          )}
        </div>

        <ol className="league-ladder" aria-label="Ligas, da primeira à última">
          {LEAGUE_NAMES.map((name, index) => {
            const current = !locked && index === view.tier;
            const passed = !locked && index < view.tier;
            return (
              <li key={name} className={`${current ? "is-current" : ""} ${passed ? "is-passed" : ""}`} aria-current={current ? "step" : undefined}>
                <Emblem rating={tierRating(index)} placement={!current && !passed} size={26} />
                <span>{name}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="cols-main">
        <div className="stack">
          {!locked && (
            <section className="card" aria-labelledby="grupo-liga">
              <div className="card-head">
                <h2 id="grupo-liga" className="section-title">
                  Seu grupo
                </h2>
                {view.member && <span className="muted">Os {view.promoteUntil} primeiros sobem</span>}
              </div>
              {view.member ? (
                <Board rows={view.table} promoteUntil={view.promoteUntil} demoteFrom={view.demoteFrom} />
              ) : (
                <p className="muted">Responda uma questão esta semana para entrar em um grupo.</p>
              )}
              {view.member && view.table.length < 10 && (
                <p className="dim" style={{ fontSize: 13.5, marginTop: 8 }}>
                  Sobe e desce valem em grupos com pelo menos 10 pessoas.
                </p>
              )}
            </section>
          )}

          {board.rows.length > 0 && (
            <section className="card" aria-labelledby="ranking-dia">
              <div className="card-head">
                <h2 id="ranking-dia" className="section-title">
                  Ranking do Plantão de hoje
                </h2>
                <span className="muted">
                  {board.total} {board.total === 1 ? "concluiu" : "concluíram"}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 13.5, margin: "4px 0 12px" }}>
                Vale quem acerta mais e, no empate, quem faz mais rápido.
              </p>
              {podium.length >= 3 && (
                <ol className="podium" aria-label="Pódio">
                  {PODIUM_ORDER.map((index) => {
                    const row = podium[index];
                    return (
                      <li key={row.nickname} className={`podium-step place-${index + 1} ${row.me ? "is-me" : ""}`}>
                        <span className="podium-name">{row.nickname}</span>
                        <span className="podium-score">
                          {row.correct}/{DAILY_SIZE} · {row.minutes} min
                        </span>
                        <span className="podium-block" aria-hidden>
                          {index + 1}
                        </span>
                        <span className="sr-only">{index + 1}º lugar</span>
                      </li>
                    );
                  })}
                </ol>
              )}
              <ol className="league-board" start={podium.length >= 3 ? 4 : 1}>
                {board.rows.slice(podium.length >= 3 ? 3 : 0, 10).map((row, i) => (
                  <li key={row.nickname} className={`league-row ${row.me ? "is-me" : ""}`}>
                    <span className="league-pos">{i + (podium.length >= 3 ? 4 : 1)}</span>
                    <span className="league-name">
                      {row.nickname}
                      {row.school && <span className="dim"> · {row.school}</span>}
                    </span>
                    <span className="league-xp">
                      {row.correct}/{DAILY_SIZE} · {row.minutes} min
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card" aria-labelledby="liga-faculdades">
            <p className="eyebrow">Liga das Faculdades</p>
            <h2 id="liga-faculdades" className="section-title" style={{ marginBottom: 4 }}>
              Média de XP por aluno ativo
            </h2>
            <p className="muted" style={{ fontSize: 13.5, marginBottom: 12 }}>
              Aparecem instituições com pelo menos 5 alunos ativos na semana. Assim, escola grande não vence só pelo tamanho.
            </p>
            {!profile.school_id && (
              <div className="alert alert-info" style={{ marginBottom: 12 }}>
                <Link href="/app/conta">Informe sua faculdade</Link> para somar pontos para ela. Seu nome não aparece nesse ranking.
              </div>
            )}
            {view.schools.length === 0 ? (
              <p className="muted">Nenhuma instituição atingiu o mínimo nesta semana.</p>
            ) : (
              <ol className="school-board">
                {view.schools.map((school, i) => (
                  <li key={school.name} className={school.mine ? "is-me" : undefined}>
                    <span className="league-pos">{i + 1}</span>
                    <span className="school-info">
                      <span className="school-name">
                        {school.name}
                        {school.uf ? ` (${school.uf})` : ""}
                      </span>
                      <span className="bar" aria-hidden>
                        <i style={{ width: `${(school.avgXp / topSchoolXp) * 100}%` }} />
                      </span>
                      <span className="dim school-meta">{school.activeMembers} alunos ativos</span>
                    </span>
                    <span className="league-xp">{school.avgXp} XP</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="aside">
          <section className="card team-card" aria-labelledby="turma">
            <p className="eyebrow">Sua turma</p>
            <h2 id="turma" className="section-title" style={{ marginBottom: 4 }}>
              Dispute com os amigos
            </h2>
            <p className="muted" style={{ fontSize: 13.5, marginBottom: 12 }}>
              Crie uma turma e mande o código para a galera. O ranking conta o XP da semana.
            </p>
            <div style={{ display: "grid", gap: 16 }}>
              {view.groups.map((group) => (
                <div key={group.id} className="team-group">
                  <div className="team-group-head">
                    <strong>{group.name}</strong>
                    <span className="pill">Código: {group.code}</span>
                  </div>
                  <Board rows={group.table} />
                  <form action={leaveGroupAction} style={{ marginTop: 6 }}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <button className="btn btn-ghost btn-sm">Sair da turma</button>
                  </form>
                </div>
              ))}
              <form action={createGroupAction} className="team-form">
                <label className="label" htmlFor="group-name">
                  Criar turma
                </label>
                <div className="team-form-row">
                  <input id="group-name" name="name" className="input" minLength={3} maxLength={40} required placeholder="Internato 2027" />
                  <button className="btn btn-primary">Criar</button>
                </div>
              </form>
              <form action={joinGroupAction} className="team-form">
                <label className="label" htmlFor="group-code">
                  Entrar com código
                </label>
                <div className="team-form-row">
                  <input id="group-code" name="code" className="input" required maxLength={12} placeholder="A1B2C3D4" />
                  <button className="btn btn-ghost">Entrar</button>
                </div>
              </form>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
