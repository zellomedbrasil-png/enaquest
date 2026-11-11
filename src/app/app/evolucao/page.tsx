import type { Metadata } from "next";
import { deleteBoletimAction } from "@/app/actions";
import { Flame } from "@/components/Flame";
import { BoletimForm } from "@/components/ProfileForms";
import { PerformanceBars, RatingChart } from "@/components/RatingChart";
import { PageHeader, ToolIcon } from "@/components/ui";
import { achievementProgress } from "@/lib/game/progress";
import { MIN_AREA_RESPONSES } from "@/lib/study/proficiency";
import { admin } from "@/lib/supabase/admin";
import { getEvolution, lifetimeStats } from "@/lib/server/progress";
import { isPremium, requireUser } from "@/lib/server/session";
import { CONFIDENCE_LABEL, ERROR_REASON_LABEL } from "@/lib/ui/labels";

export const metadata: Metadata = { title: "Evolução" };

/** Ponto do semicírculo para uma porcentagem (0 à esquerda, 100 à direita). */
function arcPoint(pct: number, r = 80, cx = 100, cy = 96) {
  const angle = Math.PI * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}

/** Medidor da faixa provável de acerto: trilho, faixa (baixo–alto) e ponteiro na estimativa. */
function Gauge({ low, high, expected }: { low: number; high: number; expected: number }) {
  const a = arcPoint(low);
  const b = arcPoint(high);
  const needle = arcPoint(expected, 62);
  const track = `M ${arcPoint(0).x} ${arcPoint(0).y} A 80 80 0 0 1 ${arcPoint(100).x} ${arcPoint(100).y}`;
  return (
    <svg className="gauge" viewBox="0 0 200 112" role="img" aria-label={`Faixa provável de ${low}% a ${high}%, estimativa de ${expected}%`}>
      <path d={track} className="gauge-track" />
      <path d={`M ${a.x} ${a.y} A 80 80 0 0 1 ${b.x} ${b.y}`} className="gauge-band" />
      <line x1="100" y1="96" x2={needle.x} y2={needle.y} className="gauge-needle" />
      <circle cx="100" cy="96" r="6" className="gauge-hub" />
      <text x="20" y="110" className="gauge-tick">
        0%
      </text>
      <text x="180" y="110" textAnchor="end" className="gauge-tick">
        100%
      </text>
    </svg>
  );
}

export default async function EvolutionPage() {
  const user = await requireUser();
  const [evolution, stats, premium, { data: owned }, { data: boletim }] = await Promise.all([
    getEvolution(user.id),
    lifetimeStats(user.id),
    isPremium(user.id),
    admin().from("achievements").select("achievement_id").eq("user_id", user.id),
    admin().from("boletins").select("score").eq("user_id", user.id).maybeSingle(),
  ]);
  const achievements = achievementProgress(stats, new Set((owned ?? []).map((a: { achievement_id: string }) => a.achievement_id)));
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const { overall } = evolution;

  // As duas áreas mais fracas (com leitura já liberada e abaixo de 70%) sobem para o topo.
  const weakest = new Set(
    evolution.areas
      .filter((area) => area.pct !== null && area.pct < 70)
      .sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))
      .slice(0, 2)
      .map((area) => area.id),
  );
  const areaRows = evolution.areas
    .map((area) => ({
      label: area.name,
      value: area.pct,
      detail: area.pct === null ? `${area.n} de ${MIN_AREA_RESPONSES} respostas` : `${area.correct} de ${area.n}`,
      color: area.color,
      priority: weakest.has(area.id),
      href: premium ? `/app/treino?area=${area.id}` : undefined,
    }))
    .sort((a, b) => Number(b.priority) - Number(a.priority));

  const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : null;
  const maxReason = Math.max(1, ...evolution.errorReasons.map((item) => item.count));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader title="Evolução" lead="Veja como você está, onde melhorar e o que já conquistou." />

      <ul className="kpi-grid" aria-label="Como você está">
        <li className="kpi">
          <ToolIcon name="treino" />
          <span className="kpi-value">{stats.answered}</span>
          <span className="kpi-label">Questões respondidas</span>
        </li>
        <li className="kpi">
          <ToolIcon name="evolucao" />
          <span className="kpi-value">
            {accuracy === null ? "–" : accuracy}
            {accuracy !== null && <small>%</small>}
          </span>
          <span className="kpi-label">Acerto geral</span>
        </li>
        <li className="kpi">
          <span className="ico" aria-hidden>
            <Flame lit={stats.bestStreak > 0} size={20} />
          </span>
          <span className="kpi-value">
            {stats.bestStreak}
            <small> {stats.bestStreak === 1 ? "dia" : "dias"}</small>
          </span>
          <span className="kpi-label">Maior sequência</span>
        </li>
        <li className="kpi">
          <ToolIcon name="revisao" />
          <span className="kpi-value">{stats.reviews}</span>
          <span className="kpi-label">Revisões feitas</span>
        </li>
      </ul>

      <div className="cols-2">
        <section className="card thermo" aria-labelledby="termometro">
          <p className="eyebrow">Termômetro de Proficiência</p>
          {!premium ? (
            <>
              <h2 id="termometro" className="section-title" style={{ margin: "4px 0" }}>
                Seu nível com faixa de incerteza
              </h2>
              <p className="muted">O Termômetro faz parte da assinatura. Ele estima seu nível por área, com faixa de incerteza.</p>
            </>
          ) : !overall.ready ? (
            <>
              <h2 id="termometro" className="section-title" style={{ margin: "4px 0" }}>
                Faltam {overall.needed} questões para a primeira leitura
              </h2>
              <p className="muted">Com pouca resposta, qualquer número seria chute. Preferimos esperar ter base.</p>
              <div className="thermo-progress">
                <div className="bar level">
                  <i style={{ width: `${(overall.responses / (overall.responses + overall.needed)) * 100}%` }} />
                </div>
                <span>
                  {overall.responses} de {overall.responses + overall.needed}
                </span>
              </div>
            </>
          ) : (
            <>
              <h2 id="termometro" className="sr-only">
                Termômetro de Proficiência
              </h2>
              <div className="thermo-reading">
                <Gauge low={overall.low ?? 0} high={overall.high ?? 0} expected={overall.expected ?? 0} />
                <div>
                  <div className="display thermo-range">
                    {overall.low}% a {overall.high}%
                  </div>
                  <p className="muted" style={{ fontSize: 14 }}>
                    Faixa provável de acerto em uma prova média, com base em {overall.responses} respostas. Estimativa pontual: {overall.expected}%.
                  </p>
                </div>
              </div>
              {overall.chanceProficient !== null ? (
                <p style={{ marginTop: 8 }}>
                  Chance estimada de atingir o nível proficiente: <strong>{overall.chanceProficient}%</strong>
                </p>
              ) : (
                <div className="alert alert-info" style={{ marginTop: 10, fontSize: 13.5 }}>
                  <strong>Ainda não comparamos com o corte oficial.</strong> O ENAMED usa uma escala própria, com corte de 60 pontos. Até termos notas reais de boletim, esta é uma estimativa interna do EnaQuest, não uma previsão de nota.
                </div>
              )}
            </>
          )}
          {premium && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Fez o ENAMED 2026? Ajude a calibrar</summary>
              <div style={{ marginTop: 8 }}>
                <BoletimForm current={boletim} />
                {boletim && (
                  <form action={deleteBoletimAction} style={{ marginTop: 8 }}>
                    <button className="btn btn-ghost btn-sm">Retirar autorização e apagar minha nota</button>
                  </form>
                )}
              </div>
            </details>
          )}
        </section>

        <section className="card" aria-labelledby="rating-tempo">
          <h2 id="rating-tempo" className="section-title">
            Rating ao longo do tempo
          </h2>
          <RatingChart data={evolution.history} />
        </section>
      </div>

      <h2 className="section-title" style={{ marginTop: 8, marginBottom: 0 }}>
        Onde melhorar
      </h2>

      <div className="cols-2">
        <section className="card" aria-labelledby="por-area">
          <div className="card-head">
            <h2 id="por-area" className="section-title">
              Desempenho por área
            </h2>
            <span className="muted">a partir de {MIN_AREA_RESPONSES} respostas</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <PerformanceBars rows={areaRows} />
          </div>
        </section>

        <div className="stack">
          <section className="card" aria-labelledby="por-que-erra">
            <h2 id="por-que-erra" className="section-title">
              Por que você erra
            </h2>
            {evolution.errorReasons.length === 0 ? (
              <p className="muted" style={{ fontSize: 14.5 }}>
                Marque o motivo ao errar uma questão e os padrões aparecem aqui.
              </p>
            ) : (
              <ul className="metric-bars">
                {evolution.errorReasons.map((item) => (
                  <li key={item.reason}>
                    <div className="metric-row">
                      <span>{ERROR_REASON_LABEL[item.reason]}</span>
                      <strong>{item.count}</strong>
                    </div>
                    <div className="bar hard" aria-hidden>
                      <i style={{ width: `${(item.count / maxReason) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-labelledby="confianca">
            <h2 id="confianca" className="section-title">
              Sua confiança é confiável?
            </h2>
            <ul className="metric-bars">
              {evolution.confidence.map((item) => {
                const pct = item.n ? Math.round((item.correct / item.n) * 100) : null;
                return (
                  <li key={item.level}>
                    <div className="metric-row">
                      <span>{CONFIDENCE_LABEL[item.level]}</span>
                      <span className="muted">{pct === null ? "Sem dados" : `${pct}% de acerto em ${item.n}`}</span>
                    </div>
                    <div className="bar" aria-hidden>
                      <i style={{ width: `${pct ?? 0}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>

      <section className="card" aria-labelledby="conquistas">
        <div className="card-head">
          <h2 id="conquistas" className="section-title">
            Conquistas
          </h2>
          <span className="muted">
            {unlocked} de {achievements.length} desbloqueadas
          </span>
        </div>
        <div className="bar level" style={{ margin: "10px 0 14px", height: 6 }} aria-hidden>
          <i style={{ width: `${(unlocked / Math.max(1, achievements.length)) * 100}%` }} />
        </div>
        <ul className="achv-grid medal-grid">
          {achievements.map((achievement) => (
            <li key={achievement.id} className={`medal ${achievement.unlocked ? "is-unlocked" : ""}`}>
              <span className="medal-icon" aria-hidden>
                {achievement.unlocked ? "★" : `${Math.round(achievement.pct * 100)}%`}
              </span>
              <span className="medal-body">
                <strong>{achievement.name}</strong>
                <span className="muted">{achievement.description}</span>
                <span className="medal-progress">
                  <span className="bar achv-bar" role="progressbar" aria-label={achievement.name} aria-valuenow={Math.round(achievement.pct * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <i style={{ width: `${achievement.pct * 100}%` }} />
                  </span>
                  <span className="medal-count">
                    {achievement.current}/{achievement.goal}
                  </span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
