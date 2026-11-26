import { markReviewedAction, publishQuestionAction, retireQuestionAction } from "@/app/actions";
import { QuestionImages } from "@/components/QuestionView";
import { getInbox, type InboxQuestion } from "@/lib/server/editorial";
import { LETTERS } from "@/lib/ui/labels";

type Kind = "attention" | "quarantined" | "unreviewed";

function QuestionCard({ question, kind }: { question: InboxQuestion; kind: Kind }) {
  return (
    <article className="card">
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
        <strong style={{ marginRight: "auto" }}>
          {question.theme}
          {question.official_number ? ` · questão ${question.official_number} da prova` : ""}
        </strong>
        <span className="pill">{question.area_id}</span>
        {question.risk_level === "alto" && (
          <span className="pill" style={{ color: "var(--bad)" }}>
            Alto risco
          </span>
        )}
        {question.annulled && (
          <span className="pill" style={{ color: "var(--bad)" }}>
            Anulada
          </span>
        )}
      </div>
      {question.hold_reason && (
        <div className="alert alert-error" style={{ marginBottom: 8 }}>
          {question.hold_reason}
        </div>
      )}
      {kind === "attention" && !question.hold_reason && (
        <p className="muted" style={{ fontSize: 14, marginBottom: 8 }}>
          Importada sem publicar.
        </p>
      )}

      <details>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Ver questão e gabarito</summary>
        <p className="stem" style={{ marginTop: 8 }}>
          {question.stem}
        </p>
        <QuestionImages images={question.images} />
        {question.exams?.map((table) => (
          <div key={table.title} style={{ marginTop: 8 }}>
            <div className="eyebrow">{table.title}</div>
            <table className="exam-table">
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row[0]}>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                    <td>{row[2] ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <ol style={{ marginTop: 10, display: "grid", gap: 4 }}>
          {question.options.map((text, i) => (
            <li key={i} style={i === question.key ? { color: "var(--ok)", fontWeight: 700 } : undefined}>
              {LETTERS[i]}. {text} {i === question.key ? "(gabarito)" : ""}
            </li>
          ))}
        </ol>
        {question.quick && (
          <div className="layer layer-quick">
            <h4>Em 20 segundos</h4>
            <p>{question.quick}</p>
          </div>
        )}
        {question.sources.length > 0 && (
          <ul className="muted" style={{ fontSize: 13.5, marginTop: 8, listStyle: "disc", paddingLeft: 18 }}>
            {question.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>{" "}
                ({s.publisher}, {s.year}) {s.locator ?? ""}
              </li>
            ))}
          </ul>
        )}
        {kind === "unreviewed" && (
          <p style={{ fontSize: 13.5, marginTop: 8 }}>
            <a href={`/app/questao/${question.slug}`} target="_blank" rel="noopener noreferrer">
              Abrir como o aluno vê, com o comentário completo
            </a>
          </p>
        )}
      </details>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
        {kind !== "unreviewed" && (
          <form action={publishQuestionAction}>
            <input type="hidden" name="id" value={question.id} />
            <button className="btn btn-primary btn-sm">Publicar</button>
          </form>
        )}
        {kind !== "attention" && (
          <form action={markReviewedAction}>
            <input type="hidden" name="id" value={question.id} />
            <button className="btn btn-ghost btn-sm">Revisei: está certa</button>
          </form>
        )}
        <form action={retireQuestionAction} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input type="hidden" name="id" value={question.id} />
          <input name="reason" className="input" style={{ width: 200 }} placeholder="Motivo (opcional)" aria-label="Motivo para retirar" />
          <button className="btn btn-danger btn-sm">Retirar</button>
        </form>
      </div>
    </article>
  );
}

function Section({ title, lead, items, total, kind, empty }: { title: string; lead: string; items: InboxQuestion[]; total: number; kind: Kind; empty: string }) {
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2 style={{ fontSize: 20 }}>
        {title} ({total})
      </h2>
      <p className="muted" style={{ fontSize: 14.5 }}>
        {lead}
      </p>
      {items.map((question) => (
        <QuestionCard key={question.id} question={question} kind={kind} />
      ))}
      {items.length === 0 && <p className="dim">{empty}</p>}
      {total > items.length && (
        <p className="dim" style={{ fontSize: 14 }}>
          Mostrando {items.length} de {total}. Resolva estas para ver as próximas.
        </p>
      )}
    </section>
  );
}

export default async function AdminHome() {
  const { attention, quarantined, unreviewed, counts } = await getInbox();
  return (
    <div style={{ display: "grid", gap: 22 }}>
      <div className="adm-note">
        As questões que passam nas checagens automáticas vão ao ar sozinhas, com o selo &quot;Verificada por IA&quot;. Aqui aparece só o que precisa de você.
        Para corrigir uma questão, edite o lote e rode <code>npm run content:publicar</code> de novo: a versão nova substitui a antiga. {counts.published} no ar,{" "}
        {counts.reviewed} revisadas por médico.
      </div>
      <Section
        title="Precisa de olho"
        lead="Ficaram fora do ar porque alguma checagem levantou dúvida. Publique se estiver certa, ou retire."
        items={attention}
        total={counts.attention}
        kind="attention"
        empty="Nada esperando."
      />
      <Section
        title="Em quarentena"
        lead="Saíram do ar sozinhas por denúncias de alunos ou estatística de acerto incoerente. Os detalhes das denúncias estão em Moderação."
        items={quarantined}
        total={counts.quarantined}
        kind="quarantined"
        empty="Nenhuma questão em quarentena."
      />
      <Section
        title="No ar sem revisão médica"
        lead="Opcional. Quando ler uma questão inteira e ela estiver certa, marque como revisada: ela ganha o selo de revisada por médico. Alto risco aparece primeiro."
        items={unreviewed}
        total={counts.unreviewed}
        kind="unreviewed"
        empty="Todas as questões no ar já foram revisadas."
      />
    </div>
  );
}
