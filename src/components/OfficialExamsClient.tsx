"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { startOfficialRoundAction } from "@/app/actions";
import type { PublicQuestion } from "@/lib/server/questions";
import type { OfficialExamSummary } from "@/lib/server/official";
import { QuestionRunner } from "./QuestionRunner";

type Area = { id: string; name: string; color: string };

export function OfficialExamsClient({
  exams,
  areas,
  premium,
  freeLimit,
}: {
  exams: OfficialExamSummary[];
  areas: Area[];
  premium: boolean;
  freeLimit: number;
}) {
  const [round, setRound] = useState<{ context: string; questions: PublicQuestion[] } | null>(null);
  const [message, setMessage] = useState<{ examId: string; text: string } | null>(null);
  const [pending, start] = useTransition();

  const begin = (examId: string, size: number) =>
    start(async () => {
      setMessage(null);
      const result = await startOfficialRoundAction(examId, size);
      if (!result.ok) return setMessage({ examId, text: result.message });
      if (!result.data.questions.length) return setMessage({ examId, text: "Não há questões disponíveis nessa prova agora." });
      setRound(result.data);
    });

  if (round) {
    return (
      <QuestionRunner
        key={round.context}
        questions={round.questions}
        mode="training"
        context={round.context}
        areas={areas}
        doneHref="/app/provas"
        doneLabel="Voltar às provas"
        onDone={() => undefined}
      />
    );
  }

  return (
    <div className="official-list">
      {exams.map((exam) => {
        const available = premium ? exam.total : Math.min(exam.total, freeLimit);
        const done = Math.min(exam.answered, available);
        const pct = exam.answered ? Math.round((exam.correct / exam.answered) * 100) : null;
        const finished = done >= available;
        return (
          <article key={exam.id} className="card official-card" aria-labelledby={`prova-${exam.id}`}>
            <div className="official-head">
              <div>
                <p className="official-board">
                  {exam.board}
                  {exam.booklet ? ` · ${exam.booklet}` : ""}
                </p>
                <h2 id={`prova-${exam.id}`}>{exam.name}</h2>
              </div>
              <span className={`pill ${exam.keyStatus === "definitivo" ? "official-key-final" : "official-key-pre"}`}>
                Gabarito {exam.keyStatus}
              </span>
            </div>

            <div className="official-progress" aria-label={`${done} de ${available} questões resolvidas`}>
              <div className="bar" aria-hidden>
                <i style={{ width: `${available ? (done / available) * 100 : 0}%` }} />
              </div>
              <p>
                <strong>
                  {done} de {available}
                </strong>{" "}
                {premium ? "questões resolvidas" : `questões da amostra grátis (a prova tem ${exam.total})`}
                {pct !== null && <span className="muted"> · {pct}% de acerto</span>}
              </p>
            </div>

            <div className="official-actions">
              {premium ? (
                <>
                  <button type="button" className="btn btn-primary" disabled={pending} onClick={() => begin(exam.id, 10)}>
                    {done === 0 ? "Começar: 10 questões" : finished ? "Refazer do início" : "Continuar: 10 questões"}
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => begin(exam.id, 20)}>
                    20 questões
                  </button>
                  <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => begin(exam.id, 100)}>
                    Até o fim da prova
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" disabled={pending} onClick={() => begin(exam.id, freeLimit)}>
                    {finished ? "Refazer a amostra" : done === 0 ? `Resolver ${available} questões grátis` : "Continuar a amostra"}
                  </button>
                  <Link href="/planos" className="btn btn-ghost">
                    Liberar a prova inteira
                  </Link>
                </>
              )}
            </div>
            {message?.examId === exam.id && (
              <p className="official-msg" role="alert">
                {message.text}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
