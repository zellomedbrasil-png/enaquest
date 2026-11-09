import { approveLotAction, decideSampleAction, rejectLotAction } from "@/app/actions";
import { getLotReview } from "@/lib/server/editorial";
import { LETTERS } from "@/lib/ui/labels";

const DECISION: Record<string, string> = { ok: "Aprovada", minor: "Com ressalva", critical: "Erro crítico" };

export default async function LotReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const { erro } = await searchParams;
  const { lot, items, total } = await getLotReview(decodeURIComponent(id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decided = items.filter((item: any) => item.sample.decision).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const critical = items.some((item: any) => item.sample.decision === "critical");
  const canDecide = lot.status === "pending_review" || lot.status === "held";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card">
        <h1 style={{ fontSize: 22 }}>{lot.id}</h1>
        <p className="muted">
          {decided} de {items.length} revisadas · lote com {total} questões
        </p>
        {lot.held_reason && (
          <div className="alert alert-error" style={{ marginTop: 8 }}>
            Motivo: {lot.held_reason}
          </div>
        )}
        {erro === "nota" && (
          <div className="alert alert-error" style={{ marginTop: 8 }}>
            Explique o problema nas notas antes de marcar ressalva ou erro crítico.
          </div>
        )}
        {canDecide && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <form action={approveLotAction}>
              <input type="hidden" name="lotId" value={lot.id} />
              <button className="btn btn-primary" disabled={decided < items.length || critical}>
                Aprovar lote e publicar
              </button>
            </form>
            <form action={rejectLotAction} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="hidden" name="lotId" value={lot.id} />
              <input name="reason" className="input" style={{ width: 240 }} placeholder="Motivo da rejeição" aria-label="Motivo da rejeição" />
              <button className="btn btn-danger">Rejeitar lote</button>
            </form>
          </div>
        )}
      </section>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {items.map((item: any, position: number) => (
        <article key={item.question.id} id={`q-${item.question.id}`} className="card">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <strong style={{ marginRight: "auto" }}>Amostra {position + 1}</strong>
            <span className="pill">{item.question.area_id}</span>
            <span className="pill">{item.question.difficulty}</span>
            {item.question.risk_level === "alto" && <span className="pill" style={{ color: "var(--bad)" }}>Alto risco</span>}
            {item.sample.decision && <span className="pill">{DECISION[item.sample.decision]}</span>}
          </div>
          <p className="stem">{item.question.stem}</p>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {item.question.exams?.map((table: any) => (
            <div key={table.title} style={{ marginTop: 8 }}>
              <div className="eyebrow">{table.title}</div>
              <table className="exam-table">
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {table.rows.map((row: any) => (
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
            {item.question.options.map((text: string, i: number) => (
              <li key={i} style={i === item.key ? { color: "var(--ok)", fontWeight: 700 } : undefined}>
                {LETTERS[i]}. {text} {i === item.key ? "(gabarito)" : ""}
              </li>
            ))}
          </ol>
          <div className="layer layer-quick">
            <h4>Em 20 segundos</h4>
            <p>{item.explanation?.quick}</p>
          </div>
          <div className="layer layer-reason">
            <h4>Raciocínio</h4>
            <p>{item.explanation?.reasoning}</p>
          </div>
          <div className="layer layer-reason">
            <h4>Distratores</h4>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {item.explanation?.distractors?.map((d: any) => (
              <p key={d.index}>
                <strong>{LETTERS[d.index]}.</strong> {d.why}
              </p>
            ))}
          </div>
          <div className="layer layer-tip">
            <h4>Macete</h4>
            <p>{item.explanation?.tip}</p>
          </div>
          <div className="layer layer-pearl">
            <h4>Armadilha clássica</h4>
            <p>{item.explanation?.pearl}</p>
          </div>
          <div style={{ fontSize: 13.5, marginTop: 8 }} className="muted">
            <strong>Fontes:</strong>
            <ul style={{ listStyle: "disc", paddingLeft: 18 }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {item.sources.map((s: any) => (
                <li key={s.sources.url}>
                  <a href={s.sources.url} target="_blank" rel="noopener noreferrer">
                    {s.sources.title}
                  </a>{" "}
                  ({s.sources.publisher}, {s.sources.year}) {s.locator ?? ""}
                </li>
              ))}
            </ul>
          </div>
          {canDecide && (
            <form action={decideSampleAction} style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <input type="hidden" name="lotId" value={lot.id} />
              <input type="hidden" name="questionId" value={item.question.id} />
              <textarea name="notes" className="textarea" defaultValue={item.sample.notes ?? ""} placeholder="Notas. Obrigatórias para ressalva e erro crítico." aria-label="Notas da revisão" />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button name="decision" value="ok" className="btn btn-primary btn-sm">
                  Aprovar
                </button>
                <button name="decision" value="minor" className="btn btn-ghost btn-sm">
                  Ressalva
                </button>
                <button name="decision" value="critical" className="btn btn-danger btn-sm">
                  Erro crítico
                </button>
              </div>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}
