"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addCommentAction,
  appealAction,
  listCommentsAction,
  reportCommentAction,
  reportQuestionAction,
  voteCommentAction,
} from "@/app/actions";
import type { CommentView, ReportKind } from "@/lib/server/community";
import type { Reveal } from "@/lib/server/questions";
import { formatDate, OFFICIAL_SEALS, REPORT_LABEL, SEALS } from "@/lib/ui/labels";
import { StudyPanel } from "./StudyPanel";

export function ReportBox({ questionId, initialOpen = null }: { questionId: string; initialOpen?: "report" | "appeal" | null }) {
  const [open, setOpen] = useState<"report" | "appeal" | null>(initialOpen);
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

/** Selo de verificação da questão e aviso educacional. */
const SHOW_TRUST_NOTICES = true;
/** Discussão da turma. Desligada por enquanto: troque para true para voltar. */
const SHOW_DISCUSSION = false;

export function RevealPanel({
  reveal,
  options,
  questionId,
  verification,
  official = null,
  selected,
  showCommunity = true,
  showReport = true,
}: {
  reveal: Reveal;
  options: string[];
  questionId: string;
  verification: string;
  /** Questão de prova oficial: o selo fala do comentário, não da autoria da questão. */
  official?: { name: string; number: number; keyStatus: string } | null;
  selected: number | null;
  showCommunity?: boolean;
  /** O runner tem o próprio botão de reportar no rodapé. */
  showReport?: boolean;
}) {
  const seal = (official ? OFFICIAL_SEALS : SEALS)[verification];
  const wrong = selected !== null && selected !== reveal.correctIndex;
  return (
    <div style={{ marginTop: 6 }}>
      <div className="layer layer-quick">
        <h4 style={{ color: "var(--sky)" }}>Em 20 segundos</h4>
        <p>{reveal.quick}</p>
      </div>

      <StudyPanel key={questionId} reveal={reveal} wrong={wrong || selected === null} />

      <div style={{ marginTop: 14, fontSize: 13.5 }} className="muted">
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
        {SHOW_TRUST_NOTICES && seal && (
          <p className="trust-seal">
            <span className={`pill seal-${verification}`}>{seal.label}</span> {seal.detail}
            {official?.keyStatus === "preliminar" && " O gabarito ainda é o preliminar e pode mudar após os recursos."}
          </p>
        )}
        {SHOW_TRUST_NOTICES && (
          <p className="dim" style={{ marginTop: 4 }}>
            Conteúdo educacional, não substitui orientação clínica nem os protocolos vigentes.
          </p>
        )}
      </div>

      {SHOW_DISCUSSION && showCommunity && <Comments questionId={questionId} />}
      {showReport && <ReportBox questionId={questionId} />}
      {options.length === 0 && null}
    </div>
  );
}
