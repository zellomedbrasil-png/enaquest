import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ExamTables, OptionsList } from "@/components/QuestionView";
import { RevealPanel } from "@/components/RevealPanel";
import { PerformanceBars } from "@/components/RatingChart";
import { ScoreRing } from "@/components/ui";
import { getSimuladoResult } from "@/lib/server/simulados";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Resultado do simulado" };

export default async function SimuladoResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const result = await getSimuladoResult(user.id, id);
  if (!result) notFound();

  const blank = result.total - result.answered;
  const wrong = result.answered - result.correct;
  const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Link href="/app/simulados" className="back-link">
        <span aria-hidden>←</span> Simulados
      </Link>

      <section className="card sim-result-hero" aria-labelledby="sim-result-title">
        <ScoreRing correct={result.correct} total={result.total} size={150} />
        <div className="sim-result-text">
          <p className="eyebrow">{result.title}</p>
          <h1 id="sim-result-title">
            {result.correct} de {result.total} · {pct}%
          </h1>
          <p className="muted">
            {result.percentile !== null ? `Melhor que ${result.percentile}% dos ${result.participants} participantes.` : `${result.participants} ${result.participants === 1 ? "participante" : "participantes"} até agora.`}
          </p>
          <p className="dim" style={{ fontSize: 13 }}>
            Este resultado é do EnaQuest, não uma previsão da sua nota oficial.
          </p>
        </div>
        <dl className="sim-result-stats">
          <div className="is-ok">
            <dt>Acertos</dt>
            <dd>{result.correct}</dd>
          </div>
          <div className="is-bad">
            <dt>Erros</dt>
            <dd>{wrong}</dd>
          </div>
          <div>
            <dt>Em branco</dt>
            <dd>{blank}</dd>
          </div>
          <div>
            <dt>Percentil</dt>
            <dd>{result.percentile === null ? "–" : `${result.percentile}%`}</dd>
          </div>
        </dl>
      </section>

      <div className="cols-2">
        <section className="card" aria-labelledby="por-area">
          <h2 id="por-area" className="section-title">
            Por área
          </h2>
          <PerformanceBars
            rows={result.byArea
              .filter((area) => area.total > 0)
              .map((area) => ({
                label: area.name,
                value: Math.round((area.correct / area.total) * 100),
                detail: `${area.correct} de ${area.total}`,
                color: area.color,
              }))}
          />
        </section>

        {result.ranking.length > 0 && (
          <section className="card" aria-labelledby="ranking-sim">
            <h2 id="ranking-sim" className="section-title">
              Ranking
            </h2>
            <ol className="league-board">
              {result.ranking.map((row, i) => (
                <li key={row.nickname} className={`league-row ${row.me ? "is-me" : ""}`}>
                  <span className="league-pos">{i + 1}</span>
                  <span className="league-name">
                    {row.nickname}
                    {row.school && <span className="dim"> · {row.school}</span>}
                  </span>
                  <span className="league-xp">{row.correct} acertos</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <section aria-labelledby="comentadas" style={{ display: "grid", gap: 10 }}>
        <div className="card-head">
          <h2 id="comentadas" className="section-title" style={{ marginBottom: 0 }}>
            Questões comentadas
          </h2>
          <span className="muted">Toque numa questão para ver o comentário</span>
        </div>
        <ul className="sim-review">
          {result.items.map((item, i) => {
            const status = item.selected === null ? "blank" : item.selected === item.reveal.correctIndex ? "ok" : "bad";
            return (
              <li key={item.question.id}>
                <details className={`sim-review-item is-${status}`}>
                  <summary>
                    <span className="sim-review-num">{i + 1}</span>
                    <span className="sim-review-theme">{item.question.theme}</span>
                    <span className={`sim-review-status is-${status}`}>{status === "blank" ? "Em branco" : status === "ok" ? "Acertou" : "Errou"}</span>
                  </summary>
                  <div className="sim-review-body">
                    <p className="stem">{item.question.stem}</p>
                    <ExamTables exams={item.question.exams} />
                    <OptionsList question={item.question} picked={item.selected} locked correctIndex={item.reveal.correctIndex} />
                    <RevealPanel reveal={item.reveal} options={item.question.options} questionId={item.question.id} verification={item.question.verification} selected={item.selected} showCommunity={item.selected !== null} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
