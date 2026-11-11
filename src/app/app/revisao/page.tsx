import type { Metadata } from "next";
import Link from "next/link";
import { PremiumGate } from "@/components/PremiumGate";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotebook, type NotebookCard } from "@/components/ErrorNotebook";
import { PageHeader } from "@/components/ui";
import { agendaLabel } from "@/lib/study/agenda";
import { QuestionRunner } from "@/components/QuestionRunner";
import { admin } from "@/lib/supabase/admin";
import { getDueReviews, getNotebook, reviewAgenda } from "@/lib/server/study";
import { isPremium, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Revisão" };

export default async function ReviewPage() {
  const user = await requireUser();
  if (!(await isPremium(user.id))) {
    return <PremiumGate title="Nunca mais erre a mesma questão" text="O que você errou ou acertou sem certeza volta na hora certa, calculada para você não esquecer." />;
  }
  const [{ context, total, questions }, notebook, { data: areas }, agenda] = await Promise.all([
    getDueReviews(user.id),
    getNotebook(user.id),
    admin().from("matrix_areas").select("id, name, color"),
    reviewAgenda(user.id),
  ]);

  const areaById = new Map<string, { id: string; name: string; color: string }>((areas ?? []).map((area: { id: string; name: string; color: string }) => [area.id, area]));
  const cards: NotebookCard[] = notebook.map((entry) => ({
    questionId: entry.questionId,
    slug: entry.slug,
    theme: entry.theme,
    areaName: areaById.get(entry.areaId)?.name ?? "Área",
    areaColor: areaById.get(entry.areaId)?.color ?? "var(--line)",
    reason: entry.reason,
    when: entry.when,
    due: entry.due,
    ready: entry.ready,
  }));
  const week = agenda.reduce((sum, entry) => sum + entry.count, 0);
  const nextIndex = agenda.findIndex((entry, index) => index > 0 && entry.count > 0);
  const noReason = notebook.filter((entry) => !entry.reason).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader
        title="Revisão"
        lead={total > 0 ? `Revise ${total} ${total === 1 ? "questão" : "questões"} agora. Elas voltaram na hora certa para você não esquecer.` : "Nada para revisar agora. O que você errar ou chutar volta aqui."}
      />

      <section className={`card review-hero ${total > 0 ? "" : "is-clear"}`} aria-label="Resumo da revisão">
        <div className="review-today">
          <span className="review-today-ring" aria-hidden>
            {total > 0 ? total : "✓"}
          </span>
          <div>
            <p className="eyebrow">Hoje</p>
            <strong>{total > 0 ? `${total} ${total === 1 ? "questão voltou" : "questões voltaram"}` : "Tudo em dia"}</strong>
            <p className="muted">
              {total > 0
                ? "Responda abaixo. Quem acerta volta mais tarde; quem erra volta logo."
                : nextIndex > 0
                  ? `Próxima: ${agendaLabel(agenda[nextIndex].day, nextIndex).toLowerCase()}, ${agenda[nextIndex].count} ${agenda[nextIndex].count === 1 ? "questão" : "questões"}.`
                  : "Nenhuma revisão marcada para os próximos 7 dias."}
            </p>
          </div>
        </div>

        <div className="review-week" aria-labelledby="agenda">
          <div className="card-head">
            <h2 id="agenda" className="eyebrow" style={{ margin: 0 }}>
              Agenda de revisão
            </h2>
            <span className="muted">{week} na semana</span>
          </div>
          <ol className="agenda">
            {agenda.map((entry, index) => (
              <li key={entry.day} className={`${index === 0 ? "today" : ""} ${entry.count ? "has" : ""}`}>
                <span className="agenda-day">{agendaLabel(entry.day, index)}</span>
                <strong className="agenda-count">{entry.count}</strong>
                <span className="sr-only">{entry.count === 1 ? "questão" : "questões"}</span>
              </li>
            ))}
          </ol>
        </div>

        <dl className="review-facts">
          <div>
            <dt>No caderno</dt>
            <dd>{notebook.length}</dd>
          </div>
          <div>
            <dt>Sem motivo marcado</dt>
            <dd>{noReason}</dd>
          </div>
        </dl>
      </section>

      {questions.length > 0 && (
        <section aria-labelledby="revisando" style={{ display: "grid", gap: 10 }}>
          <h2 id="revisando" className="section-title" style={{ marginBottom: 0 }}>
            Revisando agora
          </h2>
          <QuestionRunner questions={questions} mode="review" context={context} areas={areas ?? []} doneHref="/app/revisao" doneLabel="Ver caderno de erros" />
        </section>
      )}

      <section aria-labelledby="caderno" style={{ display: "grid", gap: 12 }}>
        <div className="card-head">
          <h2 id="caderno" className="section-title" style={{ marginBottom: 0 }}>
            Caderno de erros
          </h2>
          {noReason > 0 && <span className="muted">Marcar o motivo vale +3 XP</span>}
        </div>
        {notebook.length === 0 ? (
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
        ) : (
          <ErrorNotebook entries={cards} />
        )}
      </section>
    </div>
  );
}
