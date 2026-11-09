import type { Metadata } from "next";
import { deleteBoletimAction } from "@/app/actions";
import { BoletimForm } from "@/components/ProfileForms";
import { PerformanceBars, RatingChart } from "@/components/RatingChart";
import { achievementProgress } from "@/lib/game/progress";
import { MIN_AREA_RESPONSES } from "@/lib/study/proficiency";
import { admin } from "@/lib/supabase/admin";
import { getEvolution, lifetimeStats } from "@/lib/server/progress";
import { isPremium, requireUser } from "@/lib/server/session";
import { CONFIDENCE_LABEL, ERROR_REASON_LABEL } from "@/lib/ui/labels";

export const metadata: Metadata = { title: "Evolução" };

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
  const { overall } = evolution;
  const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <h1 style={{ fontSize: 26 }}>Evolução</h1>

      <div className="grid-4">
        {[
          ["Questões", stats.answered],
          ["Acerto geral", accuracy === null ? "–" : `${accuracy}%`],
          ["Maior sequência", `${stats.bestStreak} dias`],
          ["Revisões", stats.reviews],
        ].map(([label, value]) => (
          <div key={label} className="card stat" style={{ padding: 14 }}>
            <div className="v">{value}</div>
            <div className="k">{label}</div>
          </div>
        ))}
      </div>

      <section className="card">
        <p className="eyebrow">Termômetro de Proficiência</p>
        {!premium ? (
          <p className="muted" style={{ marginTop: 6 }}>
            O Termômetro faz parte da assinatura. Ele estima seu nível por área, com faixa de incerteza.
          </p>
        ) : !overall.ready ? (
          <>
            <h2 style={{ fontSize: 22, margin: "4px 0" }}>Faltam {overall.needed} questões para a primeira leitura</h2>
            <p className="muted">Com pouca resposta, qualquer número seria chute. Preferimos esperar ter base.</p>
            <div className="bar level" style={{ marginTop: 10 }}>
              <i style={{ width: `${(overall.responses / (overall.responses + overall.needed)) * 100}%` }} />
            </div>
          </>
        ) : (
          <>
            <div className="display" style={{ fontSize: 44, marginTop: 4 }}>
              {overall.low}% a {overall.high}%
            </div>
            <p className="muted">
              Faixa provável de acerto em uma prova de dificuldade média, com base em {overall.responses} respostas. Estimativa pontual: {overall.expected}%.
            </p>
            {overall.chanceProficient !== null ? (
              <p style={{ marginTop: 8 }}>
                Chance estimada de atingir o nível proficiente: <strong>{overall.chanceProficient}%</strong>
              </p>
            ) : (
              <div className="alert alert-info" style={{ marginTop: 10, fontSize: 14 }}>
                <strong>Ainda não comparamos com o corte oficial.</strong> O ENAMED usa uma escala própria, com corte de 60 pontos. Para traduzir sua faixa nessa escala, precisamos comparar com notas reais de boletim. Até lá, é uma estimativa interna do EnaQuest, não uma previsão de nota.
              </div>
            )}
          </>
        )}
        {premium && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14.5 }}>Fez o ENAMED 2026? Ajude a calibrar</summary>
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

      <section className="card">
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Rating ao longo do tempo</h2>
        <RatingChart data={evolution.history} />
      </section>

      <section className="card">
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Desempenho por área</h2>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>
          A porcentagem aparece a partir de {MIN_AREA_RESPONSES} respostas na área.
        </p>
        <PerformanceBars
          rows={evolution.areas.map((area) => ({
            label: area.name,
            value: area.pct,
            detail: area.pct === null ? `${area.n} de ${MIN_AREA_RESPONSES} respostas` : `${area.correct} de ${area.n}`,
          }))}
        />
      </section>

      <div className="grid-2">
        <section className="card">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Por que você erra</h2>
          {evolution.errorReasons.length === 0 ? (
            <p className="muted" style={{ fontSize: 14.5 }}>
              Marque o motivo ao errar uma questão e os padrões aparecem aqui.
            </p>
          ) : (
            <ul style={{ display: "grid", gap: 6 }}>
              {evolution.errorReasons.map((item) => (
                <li key={item.reason} style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5 }}>
                  <span>{ERROR_REASON_LABEL[item.reason]}</span>
                  <strong>{item.count}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Sua confiança é confiável?</h2>
          <ul style={{ display: "grid", gap: 6 }}>
            {evolution.confidence.map((item) => (
              <li key={item.level} style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5 }}>
                <span>{CONFIDENCE_LABEL[item.level]}</span>
                <span className="muted">{item.n ? `${Math.round((item.correct / item.n) * 100)}% de acerto em ${item.n}` : "Sem dados"}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card">
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Conquistas</h2>
        <div className="grid-2">
          {achievements.map((achievement) => (
            <div key={achievement.id} className="card-2" style={achievement.unlocked ? { background: "var(--pearl-soft)" } : undefined}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 14.5 }}>
                  {achievement.unlocked ? "★ " : ""}
                  {achievement.name}
                </strong>
                <span className="muted" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                  {achievement.current}/{achievement.goal}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 13.5 }}>
                {achievement.description}
              </p>
              <div className="bar achv-bar" role="progressbar" aria-label={achievement.name} aria-valuenow={Math.round(achievement.pct * 100)} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${achievement.pct * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
