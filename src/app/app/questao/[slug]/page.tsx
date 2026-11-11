import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExamTables, OptionsList, QuestionHeader } from "@/components/QuestionView";
import { RevealPanel } from "@/components/RevealPanel";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
import { admin } from "@/lib/supabase/admin";
import { getQuestionPage } from "@/lib/server/study";
import { isPremium, requireUser } from "@/lib/server/session";
import { ERROR_REASON_LABEL, LETTERS } from "@/lib/ui/labels";

export const metadata: Metadata = { title: "Questão" };

export default async function QuestionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const [page, premium, { data: areas }] = await Promise.all([
    getQuestionPage(user.id, slug),
    isPremium(user.id),
    admin().from("matrix_areas").select("id, name, color"),
  ]);
  if (!page) notFound();
  const area = (areas ?? []).find((a: { id: string }) => a.id === page.question.areaId) as { id: string; name: string; color: string } | undefined;

  const back = (
    <Link href="/app/revisao" className="back-link">
      <span aria-hidden>←</span> Caderno de erros
    </Link>
  );

  if (!page.answer || !page.reveal) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        {back}
        <EmptyState
          title="Comentário bloqueado"
          action={
            <Link href="/app/treino" className="btn btn-primary">
              Ir para o treino
            </Link>
          }
        >
          Responda a esta questão no Plantão ou no Treino para ver o comentário completo.
        </EmptyState>
      </div>
    );
  }

  const { answer, reveal } = page;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {back}
      <PageHeader
        title={page.question.theme}
        lead={answer.correct ? "Você acertou esta questão. Releia o comentário para fixar." : "Você errou esta questão. Entenda o detalhe que mudou a resposta."}
        action={
          premium && area ? (
            <Link href={`/app/treino?area=${area.id}`} className="btn btn-ghost">
              Treinar {area.name}
            </Link>
          ) : undefined
        }
      />

      <article className="card qgrid is-answered" aria-label={`Questão: ${page.question.theme}`}>
        <div className="qleft">
          <div>
            <QuestionHeader question={page.question} areaName={area?.name} areaColor={area?.color} />
            <p className="stem">{page.question.stem}</p>
            <ExamTables exams={page.question.exams} />
            <OptionsList question={page.question} picked={answer.selected} locked correctIndex={reveal.correctIndex} />
          </div>
        </div>

        <div className="qright">
          <div className="result-box" role="status" style={{ background: answer.correct ? "var(--ok-soft)" : "var(--bad-soft)" }}>
            <strong style={{ color: answer.correct ? "var(--ok)" : "var(--bad)" }}>{answer.correct ? "Você acertou" : "Você errou"}</strong>
            <span className="pill">Sua resposta: {LETTERS[answer.selected]}</span>
            <span className="pill">Correta: {LETTERS[reveal.correctIndex]}</span>
            {answer.reason && <span className="pill">Motivo: {ERROR_REASON_LABEL[answer.reason]}</span>}
          </div>
          <RevealPanel
            reveal={reveal}
            options={page.question.options}
            questionId={page.question.id}
            verification={page.question.verification}
            selected={answer.selected}
            answerId={answer.id}
            errorReason={answer.reason}
          />
        </div>
      </article>
    </div>
  );
}
