"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ACHIEVEMENTS, type Mission } from "@/lib/game/progress";
import { MyMascot } from "./MyMascot";
import { ScoreRing, scoreMessage } from "./ui";

export type RoundItem = { questionId: string; areaId: string; correct: boolean; ms: number };
type Area = { id: string; name: string; color: string };

function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min ${String(seconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}min`;
}

const ICON = {
  check: "m5 12 5 5L20 7",
  cross: "M6 6l12 12M18 6 6 18",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  redo: "M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15m0 5v-5h5",
  path: "M3 12h4l3-8 4 16 3-8h4",
  chart: "M3 17l6-6 4 4 8-9",
  more: "M4 19V9m5 10V5m6 14v-7m5 7V8",
  spark: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6",
} as const;

function Svg({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

type NextAction = { key: string; title: string; text: string; icon: keyof typeof ICON; href?: string; onClick?: () => void };

function ActionCard({ action, primary }: { action: NextAction; primary: boolean }) {
  const body: ReactNode = (
    <>
      <Svg d={ICON[action.icon]} className="sum-action-icon" />
      <span>
        <strong>{action.title}</strong>
        <small>{action.text}</small>
      </span>
      <span className="sum-action-arrow" aria-hidden>
        →
      </span>
    </>
  );
  const className = `sum-action${primary ? " is-primary" : ""}`;
  return action.href ? (
    <Link href={action.href} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" className={className} onClick={action.onClick}>
      {body}
    </button>
  );
}

/** Fim de rodada: resultado, o próximo passo conforme os erros e, recolhido, o detalhe do jogo. */
export function RoundSummary({
  items,
  areas,
  mode,
  xp,
  ratingSum,
  bestCombo,
  streak,
  earned,
  missions,
  doneHref,
  doneLabel,
  onReviewWrong,
}: {
  items: RoundItem[];
  areas: Area[];
  mode: "daily" | "training" | "review";
  xp: { answers: number; bonus: number; achievements: number };
  ratingSum: number;
  bestCombo: number;
  streak: number | null;
  earned: string[];
  missions: Mission[] | null;
  doneHref: string;
  doneLabel: string;
  onReviewWrong: () => void;
}) {
  const total = items.length;
  const hits = items.filter((i) => i.correct).length;
  const wrong = total - hits;
  const totalMs = items.reduce((sum, i) => sum + i.ms, 0);
  const totalXp = xp.answers + xp.bonus + xp.achievements;
  const message = scoreMessage(hits, total);

  const byArea = areas
    .map((area) => {
      const own = items.filter((i) => i.areaId === area.id);
      return { ...area, n: own.length, hits: own.filter((i) => i.correct).length };
    })
    .filter((a) => a.n > 0)
    .sort((a, b) => a.hits / a.n - b.hits / b.n);

  const reviewWrong: NextAction = {
    key: "erros",
    title: wrong === 1 ? "Rever a que errei" : "Rever as que errei",
    text: wrong === 1 ? "Releia o comentário agora. Ela também volta na sua Revisão." : "Releia os comentários agora. Elas também voltam na sua Revisão.",
    icon: "redo",
    onClick: onReviewWrong,
  };
  const continueDay: NextAction = { key: "dia", title: "Continuar meu dia", text: "Veja o próximo passo da sua jornada de hoje.", icon: "path", href: "/app" };
  const again: NextAction =
    mode === "daily"
      ? { key: "mais", title: "Treinar mais", text: "Filtre por área, tema, prova e dificuldade.", icon: "more", href: "/app/treino" }
      : { key: "mais", title: doneLabel, text: mode === "review" ? "Veja tudo o que está guardado para rever." : "Monte outra rodada com outros filtros.", icon: "more", href: doneHref };
  const evolution: NextAction = { key: "evolucao", title: "Ver minha evolução", text: "Seu acerto em cada área da prova.", icon: "chart", href: "/app/evolucao" };
  const actions = wrong > 0 ? [reviewWrong, continueDay, again] : [continueDay, again, evolution];

  const advice =
    total === 0
      ? { lead: "Nenhuma questão respondida nesta rodada.", rest: "" }
      : wrong === 0
        ? { lead: "Você acertou todas.", rest: " Siga para o próximo passo enquanto está no ritmo." }
        : { lead: `Você errou ${wrong} ${wrong === 1 ? "questão" : "questões"}.`, rest: " Comece pelo que errou: é onde você mais ganha agora." };

  return (
    <div className="sum">
      <section className="sum-card" aria-labelledby="sum-title">
        <div className="sum-head">
          <div className="sum-head-text">
            <p className="sum-eyebrow">
              <Svg d={ICON.spark} />
              Rodada concluída
            </p>
            <h2 id="sum-title">{message.title}</h2>
            <p className="muted">
              {totalXp > 0 ? (
                <>
                  Você ganhou <strong>{totalXp} XP</strong> nesta rodada.
                </>
              ) : (
                "Veja seu resultado e escolha como seguir."
              )}
            </p>
            <span className="sum-pill">
              <Svg d={ICON.check} />
              {total} {total === 1 ? "questão respondida" : "questões respondidas"}
            </span>
          </div>
          <div className="sum-ring">
            <ScoreRing correct={hits} total={total} size={140} />
            <span className="sum-ring-mascot">
              <MyMascot mood={total > 0 && hits / total >= 0.7 ? "comemorando" : "feliz"} size={64} />
            </span>
          </div>
        </div>

        <dl className="sum-stats">
          <div>
            <dt>
              <Svg d={ICON.check} className="is-ok" />
              Corretas
            </dt>
            <dd>{hits}</dd>
          </div>
          <div>
            <dt>
              <Svg d={ICON.cross} className="is-bad" />
              Incorretas
            </dt>
            <dd>{wrong}</dd>
          </div>
          <div>
            <dt>
              <Svg d={ICON.clock} className="is-info" />
              Tempo
            </dt>
            <dd>{duration(totalMs)}</dd>
          </div>
        </dl>

        <div className="sum-next">
          <p>
            <strong>{advice.lead}</strong>
            {advice.rest}
          </p>
          <div className="sum-actions">
            {actions.map((action, i) => (
              <ActionCard key={action.key} action={action} primary={i === 0} />
            ))}
          </div>
        </div>
      </section>

      {earned.length > 0 && (
        <div className="sum-earned">
          {earned.map((id) => (
            <span key={id} className="pill" style={{ background: "var(--pearl-soft)", color: "var(--gold)" }}>
              Conquista: {ACHIEVEMENTS.find((a) => a.id === id)?.name}
            </span>
          ))}
        </div>
      )}

      <details className="sum-details">
        <summary>
          <Svg d={ICON.chart} />
          Ver desempenho detalhado
        </summary>
        <div className="sum-details-body">
          {byArea.length > 0 && (
            <div>
              <p className="eyebrow">Acerto por área nesta rodada</p>
              <ul className="sum-areas">
                {byArea.map((area) => (
                  <li key={area.id}>
                    <span className="focus-dot" style={{ background: area.color }} aria-hidden />
                    <span>{area.name}</span>
                    <span className="bar" aria-hidden>
                      <i style={{ width: `${(area.hits / area.n) * 100}%`, background: area.color }} />
                    </span>
                    <span className="sum-areas-n">
                      {area.hits}/{area.n}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="eyebrow">Pontos da rodada</p>
            <dl className="round-stats">
              <div>
                <dt>XP das respostas</dt>
                <dd>+{xp.answers}</dd>
              </div>
              {xp.bonus > 0 && (
                <div>
                  <dt>Bônus do plantão</dt>
                  <dd>+{xp.bonus}</dd>
                </div>
              )}
              {xp.achievements > 0 && (
                <div>
                  <dt>Conquistas</dt>
                  <dd>+{xp.achievements}</dd>
                </div>
              )}
              <div>
                <dt>Rating</dt>
                <dd>
                  {ratingSum > 0 ? "+" : ""}
                  {ratingSum}
                </dd>
              </div>
              <div>
                <dt>Maior combo</dt>
                <dd>{bestCombo}</dd>
              </div>
              {streak !== null && (
                <div>
                  <dt>Sequência</dt>
                  <dd>
                    {streak} {streak === 1 ? "dia" : "dias"}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {missions && (
            <div>
              <p className="eyebrow">Missões de hoje</p>
              <ul className="mission-list" style={{ marginTop: 8 }}>
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
            </div>
          )}
        </div>
      </details>

      <div className="sum-footer">
        <Link href="/app" className="btn btn-ghost">
          Voltar para Hoje
        </Link>
      </div>
    </div>
  );
}
