import { decideAppealAction, moderateCommentAction, resolveReportAction, setQuestionStatusAction } from "@/app/actions";
import { getModerationQueue } from "@/lib/server/editorial";
import { formatDateTime } from "@/lib/ui/labels";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ModerationPage() {
  const { reports, appeals, comments, quarantined } = await getModerationQueue();
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Em quarentena ({quarantined.length})</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {quarantined.map((question: any) => (
            <div key={question.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span>
                <strong>{question.slug}</strong> · {question.theme}
              </span>
              <span style={{ display: "flex", gap: 6 }}>
                <form action={setQuestionStatusAction}>
                  <input type="hidden" name="id" value={question.id} />
                  <input type="hidden" name="status" value="published" />
                  <button className="btn btn-ghost btn-sm">Republicar</button>
                </form>
                <form action={setQuestionStatusAction}>
                  <input type="hidden" name="id" value={question.id} />
                  <input type="hidden" name="status" value="retired" />
                  <button className="btn btn-danger btn-sm">Retirar</button>
                </form>
              </span>
            </div>
          ))}
          {quarantined.length === 0 && <p className="muted">Nenhuma.</p>}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Recursos ({appeals.length})</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {appeals.map((appeal: any) => (
            <div key={appeal.id} className="card">
              <strong>{appeal.questions?.slug}</strong> <span className="muted">· {appeal.profiles?.nickname} · {formatDateTime(appeal.created_at)}</span>
              <p style={{ margin: "6px 0", whiteSpace: "pre-line" }}>{appeal.argument}</p>
              <form action={decideAppealAction} style={{ display: "grid", gap: 6 }}>
                <input type="hidden" name="id" value={appeal.id} />
                <input name="note" className="input" placeholder="Resposta ao aluno" aria-label="Resposta ao aluno" required />
                <div style={{ display: "flex", gap: 6 }}>
                  <button name="status" value="deferido" className="btn btn-primary btn-sm">
                    Deferir
                  </button>
                  <button name="status" value="indeferido" className="btn btn-ghost btn-sm">
                    Indeferir
                  </button>
                </div>
              </form>
            </div>
          ))}
          {appeals.length === 0 && <p className="muted">Nenhum.</p>}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Denúncias ({reports.length})</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {reports.map((report: any) => (
            <div key={report.id} className="card">
              <strong>{report.kind}</strong> <span className="muted">· {report.questions?.slug ?? "comentário"} · {report.profiles?.nickname}</span>
              {report.body && <p style={{ margin: "6px 0" }}>{report.body}</p>}
              {report.comments?.body && <p className="muted" style={{ margin: "6px 0" }}>&ldquo;{report.comments.body}&rdquo;</p>}
              <form action={resolveReportAction} style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input type="hidden" name="id" value={report.id} />
                <button name="status" value="resolvida" className="btn btn-primary btn-sm">
                  Resolvida
                </button>
                <button name="status" value="descartada" className="btn btn-ghost btn-sm">
                  Descartar
                </button>
              </form>
            </div>
          ))}
          {reports.length === 0 && <p className="muted">Nenhuma.</p>}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Comentários recentes</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {comments.map((comment: any) => (
            <div key={comment.id} className="card" style={comment.hidden ? { opacity: 0.6 } : undefined}>
              <strong>{comment.profiles?.nickname}</strong> <span className="muted">· {comment.questions?.slug} · {comment.votes} votos</span>
              <p style={{ margin: "6px 0", whiteSpace: "pre-line" }}>{comment.body}</p>
              <form action={moderateCommentAction} style={{ display: "flex", gap: 6 }}>
                <input type="hidden" name="id" value={comment.id} />
                <button name="action" value={comment.hidden ? "show" : "hide"} className="btn btn-ghost btn-sm">
                  {comment.hidden ? "Mostrar" : "Ocultar"}
                </button>
                <button name="action" value={comment.pinned ? "unpin" : "pin"} className="btn btn-ghost btn-sm">
                  {comment.pinned ? "Tirar destaque" : "Destacar"}
                </button>
              </form>
            </div>
          ))}
          {comments.length === 0 && <p className="muted">Nenhum.</p>}
        </div>
      </section>
    </div>
  );
}
