import type { Metadata } from "next";
import Link from "next/link";
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
      <div className="card" style={{ textAlign: "center" }}>
        <p>O plantão de hoje ainda não tem questões publicadas.</p>
        <Link href="/app" className="btn btn-ghost" style={{ marginTop: 10 }}>
          Voltar
        </Link>
      </div>
    );
  }

  if (daily.done) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <h1 style={{ fontSize: 26 }}>Questões de hoje</h1>
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
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Plantão do Dia</h1>
      <QuestionRunner questions={daily.questions} mode="daily" context={day} areas={areas ?? []} alreadyAnswered={daily.answered} />
    </div>
  );
}
