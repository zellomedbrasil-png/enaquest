import type { Metadata } from "next";
import Link from "next/link";
import { PremiumGate } from "@/components/PremiumGate";
import { QuestionRunner } from "@/components/QuestionRunner";
import { admin } from "@/lib/supabase/admin";
import { getDueReviews, getNotebook } from "@/lib/server/study";
import { isPremium, requireUser } from "@/lib/server/session";
import { ERROR_REASON_LABEL, formatDate } from "@/lib/ui/labels";

export const metadata: Metadata = { title: "Revisão" };

export default async function ReviewPage() {
  const user = await requireUser();
  if (!(await isPremium(user.id))) {
    return <PremiumGate title="Nunca mais erre a mesma questão" text="O que você errou ou acertou sem certeza volta na hora certa, calculada para você não esquecer." />;
  }
  const [{ context, total, questions }, notebook, { data: areas }] = await Promise.all([
    getDueReviews(user.id),
    getNotebook(user.id),
    admin().from("matrix_areas").select("id, name, color"),
  ]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Revisão</h1>
        <p className="muted">{total > 0 ? `${total} para revisar agora.` : "Nada pendente agora. Volte amanhã."}</p>
      </div>
      {questions.length > 0 && <QuestionRunner questions={questions} mode="review" context={context} areas={areas ?? []} doneHref="/app/revisao" doneLabel="Ver caderno de erros" />}

      <section>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Caderno de erros</h2>
        {notebook.length === 0 && <p className="muted">Seus erros aparecem aqui. Cada um vira uma chance de aprender.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {notebook.map((entry) => (
            <Link key={entry.questionId} href={`/app/questao/${entry.slug}`} className="card" style={{ textDecoration: "none", padding: 12 }}>
              <strong style={{ fontSize: 15 }}>{entry.theme}</strong>
              <p className="muted" style={{ fontSize: 13.5 }}>
                {entry.reason ? ERROR_REASON_LABEL[entry.reason] : "Motivo não marcado"} · errou em {formatDate(entry.when)}
                {entry.due ? ` · volta em ${formatDate(entry.due)}` : ""}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
