import { notFound } from "next/navigation";
import { z } from "zod";
import { ExamTables, OptionsList } from "@/components/QuestionView";
import { RevealPanel } from "@/components/RevealPanel";
import { PerformanceBars } from "@/components/RatingChart";
import { getSimuladoResult } from "@/lib/server/simulados";
import { requireUser } from "@/lib/server/session";

export default async function SimuladoResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const result = await getSimuladoResult(user.id, id);
  if (!result) notFound();

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ textAlign: "center" }}>
        <p className="eyebrow">{result.title}</p>
        <div className="display" style={{ fontSize: 60 }}>
          {result.correct}/{result.total}
        </div>
        <p className="muted">
          {result.percentile !== null ? `Melhor que ${result.percentile}% dos ${result.participants} participantes.` : `${result.participants} participantes até agora.`}{" "}
          {result.answered < result.total ? `${result.total - result.answered} ficaram em branco.` : ""}
        </p>
        <p className="dim" style={{ fontSize: 13, marginTop: 6 }}>
          Este resultado é do EnaQuest, não uma previsão da sua nota oficial.
        </p>
      </section>

      <section className="card">
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Por área</h2>
        <PerformanceBars
          rows={result.byArea
            .filter((area) => area.total > 0)
            .map((area) => ({
              label: area.name,
              value: Math.round((area.correct / area.total) * 100),
              detail: `${area.correct} de ${area.total}`,
            }))}
        />
      </section>

      {result.ranking.length > 0 && (
        <section className="card">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Ranking</h2>
          <div className="rows" style={{ gap: 2 }}>
            {result.ranking.map((row, i) => (
              <div key={row.nickname} className={`row-board ${row.me ? "me" : ""}`}>
                <span className="display">{i + 1}</span>
                <span>
                  {row.nickname}
                  {row.school && <span className="dim"> · {row.school}</span>}
                </span>
                <span>{row.correct}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: 20 }}>Questões comentadas</h2>
        {result.items.map((item, i) => {
          const correct = item.selected === item.reveal.correctIndex;
          return (
            <details key={item.question.id} className="card">
              <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span>
                  <strong>{i + 1}.</strong> {item.question.theme}
                </span>
                <span style={{ fontWeight: 700, color: item.selected === null ? "var(--mute)" : correct ? "var(--ok)" : "var(--bad)" }}>
                  {item.selected === null ? "Em branco" : correct ? "Acertou" : "Errou"}
                </span>
              </summary>
              <div style={{ marginTop: 10 }}>
                <p className="stem">{item.question.stem}</p>
                <ExamTables exams={item.question.exams} />
                <OptionsList question={item.question} picked={item.selected} locked correctIndex={item.reveal.correctIndex} />
                <RevealPanel reveal={item.reveal} options={item.question.options} questionId={item.question.id} verification={item.question.verification} selected={item.selected} showCommunity={item.selected !== null} />
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}
