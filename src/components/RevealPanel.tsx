"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addCommentAction,
  appealAction,
  errorReasonAction,
  listCommentsAction,
  reportCommentAction,
  reportQuestionAction,
  voteCommentAction,
} from "@/app/actions";
import type { CommentView, ReportKind } from "@/lib/server/community";
import type { Reveal } from "@/lib/server/questions";
import type { ErrorReason } from "@/lib/server/answers";
import { ERROR_REASON_LABEL, formatDate, REPORT_LABEL, SEALS } from "@/lib/ui/labels";

export function ErrorDiagnosis({ answerId, initial }: { answerId: string; initial?: string | null }) {
  const [reason, setReason] = useState<string | null>(initial ?? null);
  return (
    <div style={{ marginTop: 12 }}>
      <div className="eyebrow" style={{ marginBottom: 2 }}>
        Por que você errou?
      </div>
      <p className="dim" style={{ fontSize: 13.5, marginBottom: 6 }}>
        Marque o motivo: vale +3 XP e mostra seus padrões na Evolução.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {Object.entries(ERROR_REASON_LABEL).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="btn btn-ghost btn-sm"
            aria-pressed={reason === key}
            style={reason === key ? { borderColor: "var(--accent)", background: "var(--tip-soft)" } : undefined}
            onClick={() => {
              setReason(key);
              errorReasonAction(answerId, key as ErrorReason);
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReportBox({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState<"report" | "appeal" | null>(null);
  const [kind, setKind] = useState<ReportKind>("gabarito");
  const [text, setText] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const result =
        open === "report" ? await reportQuestionAction(questionId, kind, text || null) : await appealAction(questionId, text);
      if (result.ok) {
        setMessage({
          ok: true,
          text: open === "report" ? "Denúncia recebida. Obrigado." : "Recurso enviado. Um médico vai analisar e responder.",
        });
        setOpen(null);
        setText("");
      } else {
        setMessage({ ok: false, text: result.message });
      }
    });

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(open === "report" ? null : "report")}>
          Reportar problema
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(open === "appeal" ? null : "appeal")}>
          Entrar com recurso
        </button>
      </div>
      {open && (
        <div className="card-2" style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {open === "report" && (
            <div>
              <label className="label" htmlFor={`kind-${questionId}`}>
                Qual é o problema?
              </label>
              <select id={`kind-${questionId}`} className="select" value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
                {Object.entries(REPORT_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor={`text-${questionId}`}>
              {open === "report" ? "Detalhes (opcional)" : "Seu argumento, de preferência com a fonte"}
            </label>
            <textarea id={`text-${questionId}`} className="textarea" value={text} onChange={(e) => setText(e.target.value)} maxLength={open === "report" ? 1000 : 2000} />
          </div>
          <div>
            <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={send}>
              Enviar
            </button>
          </div>
        </div>
      )}
      {message && (
        <div className={`alert ${message.ok ? "alert-ok" : "alert-error"}`} style={{ marginTop: 8 }} role="status">
          {message.text}
        </div>
      )}
    </div>
  );
}

export function Comments({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommentView[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open || comments) return;
    listCommentsAction(questionId).then((result) => {
      if (result.ok) setComments(result.data);
      else setError(result.message);
    });
  }, [open, comments, questionId]);

  const send = () =>
    start(async () => {
      setError(null);
      const result = await addCommentAction(questionId, text);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setText("");
      const refreshed = await listCommentsAction(questionId);
      if (refreshed.ok) setComments(refreshed.data);
    });

  const vote = async (id: string) => {
    const result = await voteCommentAction(id);
    if (result.ok) {
      setComments((list) => list?.map((c) => (c.id === id ? { ...c, votes: result.data, votedByMe: true } : c)) ?? null);
    } else {
      setError(result.message);
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Fechar discussão" : "Ver discussão da turma"}
      </button>
      {open && (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {comments === null && !error && <p className="muted">Carregando…</p>}
          {comments?.length === 0 && <p className="muted">Ninguém comentou ainda. Comece a discussão.</p>}
          {comments?.map((comment, i) => (
            <div key={comment.id} className="card-2">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <strong style={{ fontSize: 14 }}>
                  {comment.nickname}
                  {comment.pinned && <span className="pill" style={{ marginLeft: 6 }}>Destaque da curadoria</span>}
                  {!comment.pinned && i === 0 && comment.votes >= 3 && <span className="pill" style={{ marginLeft: 6 }}>Mais votado</span>}
                </strong>
                <span className="dim" style={{ fontSize: 12.5 }}>
                  {formatDate(comment.createdAt)}
                </span>
              </div>
              <p style={{ fontSize: 15, whiteSpace: "pre-line" }}>{comment.body}</p>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={comment.mine || comment.votedByMe}
                  onClick={() => vote(comment.id)}
                  aria-label={`Marcar comentário como útil, ${comment.votes} votos`}
                >
                  Útil · {comment.votes}
                </button>
                {!comment.mine && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => reportCommentAction(comment.id)}>
                    Denunciar
                  </button>
                )}
              </div>
            </div>
          ))}
          <div>
            <label className="label" htmlFor={`new-${questionId}`}>
              Seu comentário
            </label>
            <textarea
              id={`new-${questionId}`}
              className="textarea"
              maxLength={1500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Traga um raciocínio ou um macete. Comentários úteis rendem XP."
            />
            <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 6 }} disabled={pending || text.trim().length < 3} onClick={send}>
              Publicar
            </button>
          </div>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Comentário em camadas: do resumo rápido até a fonte. */
export function RevealPanel({
  reveal,
  options,
  questionId,
  verification,
  selected,
  answerId,
  errorReason,
  showCommunity = true,
}: {
  reveal: Reveal;
  options: string[];
  questionId: string;
  verification: string;
  selected: number | null;
  answerId?: string | null;
  errorReason?: string | null;
  showCommunity?: boolean;
}) {
  const seal = SEALS[verification];
  const wrong = selected !== null && selected !== reveal.correctIndex;
  return (
    <div style={{ marginTop: 6 }}>
      {wrong && answerId && <ErrorDiagnosis answerId={answerId} initial={errorReason} />}

      <div className="layer layer-quick">
        <h4 style={{ color: "var(--sky)" }}>Em 20 segundos</h4>
        <p>{reveal.quick}</p>
      </div>
      <p className="dim" style={{ fontSize: 13.5, margin: "6px 0 2px" }}>
        Toque em um título abaixo para ler mais.
      </p>

      <details className="layer layer-reason" open={wrong}>
        <summary>
          <h4>Raciocínio clínico</h4>
        </summary>
        <p>{reveal.reasoning}</p>
      </details>

      <details className="layer layer-reason">
        <summary>
          <h4>Por que as outras estão erradas</h4>
        </summary>
        <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
          {reveal.distractors.map((item) => (
            <p key={item.index}>
              <strong>{String.fromCharCode(65 + item.index)}.</strong> {item.why}
              {reveal.stats.optionPct.length > 0 && <span className="dim"> ({reveal.stats.optionPct[item.index] ?? 0}% marcaram)</span>}
            </p>
          ))}
        </div>
      </details>

      <details className="layer layer-tip">
        <summary>
          <h4 style={{ color: "var(--accent)" }}>Macete de prova</h4>
        </summary>
        <p>{reveal.tip}</p>
      </details>

      <details className="layer layer-pearl">
        <summary>
          <h4 style={{ color: "var(--gold)" }}>Armadilha clássica</h4>
        </summary>
        <p>{reveal.pearl}</p>
      </details>

      <details className="layer layer-reason">
        <summary>
          <h4>O que a prova quer de você</h4>
        </summary>
        <p>{reveal.competencyNote}</p>
      </details>

      <div style={{ marginTop: 10, fontSize: 13.5 }} className="muted">
        {reveal.stats.correctPct !== null && (
          <p>
            <strong>{reveal.stats.correctPct}%</strong> dos {reveal.stats.n} alunos acertaram.
          </p>
        )}
        {reveal.sources.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <strong>Fontes:</strong>
            <ul style={{ listStyle: "disc", paddingLeft: 18 }}>
              {reveal.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title}
                  </a>{" "}
                  ({source.publisher}, {source.year}){source.locator ? `, ${source.locator}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {seal && (
          <p style={{ marginTop: 6 }}>
            <span className="pill">{seal.label}</span> {seal.detail}
          </p>
        )}
        <p className="dim" style={{ marginTop: 4 }}>
          Conteúdo educacional, não substitui orientação clínica nem os protocolos vigentes.
        </p>
      </div>

      {showCommunity && (
        <>
          <Comments questionId={questionId} />
          <ReportBox questionId={questionId} />
        </>
      )}
      {options.length === 0 && null}
    </div>
  );
}
