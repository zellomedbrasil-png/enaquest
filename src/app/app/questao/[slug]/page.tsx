import { notFound } from "next/navigation";
import { ExamTables, OptionsList, QuestionHeader } from "@/components/QuestionView";
import { RevealPanel } from "@/components/RevealPanel";
import { admin } from "@/lib/supabase/admin";
import { getQuestionPage } from "@/lib/server/study";
import { requireUser } from "@/lib/server/session";
import Link from "next/link";

export default async function QuestionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const page = await getQuestionPage(user.id, slug);
  if (!page) notFound();
  const { data: areas } = await admin().from("matrix_areas").select("id, name, color");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const area = (areas ?? []).find((a: any) => a.id === page.question.areaId);

  if (!page.answer || !page.reveal) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <p>Responda a esta questão no plantão ou no treino para ver o comentário.</p>
        <Link href="/app/treino" className="btn btn-ghost" style={{ marginTop: 10 }}>
          Ir para o treino
        </Link>
      </div>
    );
  }

  return (
    <article className="card">
      <QuestionHeader question={page.question} areaName={area?.name} areaColor={area?.color} />
      <p className="stem">{page.question.stem}</p>
      <ExamTables exams={page.question.exams} />
      <OptionsList question={page.question} picked={page.answer.selected} locked correctIndex={page.reveal.correctIndex} />
      <RevealPanel
        reveal={page.reveal}
        options={page.question.options}
        questionId={page.question.id}
        verification={page.question.verification}
        selected={page.answer.selected}
        answerId={page.answer.id}
        errorReason={page.answer.reason}
      />
    </article>
  );
}
