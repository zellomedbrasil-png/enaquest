import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
import { QuestionRunner } from "@/components/QuestionRunner";
import { admin } from "@/lib/supabase/admin";
import { todayBR } from "@/lib/game/streak";
import { getDailyState } from "@/lib/server/daily";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Plantão do Dia" };

export default async function DailyPage() {
  const user = await requireUser();
  const day = todayBR();
  const daily = await getDailyState(user.id, day);
  const { data: areas } = await admin().from("matrix_areas").select("id, name, color");

  if (!daily.questions.length) {
    return (
      <EmptyState
        title="O plantão de hoje ainda não foi escalado"
        action={
          <Link href="/app" className="btn btn-ghost">
            Voltar para Hoje
          </Link>
        }
      >
        Ainda não há questões publicadas. Assim que o primeiro lote for aprovado, elas aparecem aqui.
      </EmptyState>
    );
  }

  if (daily.done) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <PageHeader title="Questões de hoje" lead="Toque em uma questão para rever a explicação." />
        <div className="cols-2" style={{ gap: 10, alignItems: "stretch" }}>
        {daily.questions.map((question, i) => (
          <Link key={question.id} href={`/app/questao/${question.slug}`} className="card" style={{ textDecoration: "none", display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span>
              <strong>{i + 1}.</strong> {question.theme}
            </span>
            <span style={{ color: daily.answered[question.id]?.correct ? "var(--ok)" : "var(--bad)", fontWeight: 700 }}>
              {daily.answered[question.id]?.correct ? "Acertou" : "Errou"}
            </span>
          </Link>
        ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Plantão do Dia" lead="10 questões iguais para todos. Responda uma de cada vez." />
      <div style={{ height: 12 }} />
      <QuestionRunner questions={daily.questions} mode="daily" context={day} areas={areas ?? []} alreadyAnswered={daily.answered} />
    </div>
  );
}
