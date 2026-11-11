import type { Metadata } from "next";
import Link from "next/link";
import { PremiumGate } from "@/components/PremiumGate";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
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
      <PageHeader
        title="Revisão"
        lead={total > 0 ? `Revise ${total} ${total === 1 ? "questão" : "questões"} agora. Elas voltaram na hora certa para você não esquecer.` : "Nada para revisar agora. O que você errar ou chutar volta aqui."}
      />
      {questions.length > 0 && <QuestionRunner questions={questions} mode="review" context={context} areas={areas ?? []} doneHref="/app/revisao" doneLabel="Ver caderno de erros" />}

      <section>
        <h2 className="section-title">Caderno de erros</h2>
        {notebook.length === 0 && (
          <EmptyState
            title="Nenhum erro ainda"
            action={
              <Link href="/app/plantao" className="btn btn-primary">
                Fazer o Plantão do Dia
              </Link>
            }
          >
            Faça o Plantão do Dia e seus erros aparecem aqui. Cada um vira uma chance de aprender.
          </EmptyState>
        )}
        <div className="cols-2" style={{ gap: 8, alignItems: "stretch" }}>
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
