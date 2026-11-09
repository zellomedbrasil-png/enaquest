"use client";

import { useActionState, useState } from "react";
import { saveBoletimAction, updateProfileAction, withdrawAction } from "@/app/actions";

export function ProfileForm({
  nickname,
  schoolId,
  showSchool,
  schools,
}: {
  nickname: string;
  schoolId: string | null;
  showSchool: boolean;
  schools: { id: string; name: string; uf: string | null }[];
}) {
  const [state, action, pending] = useActionState(updateProfileAction, {});
  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      <div>
        <label className="label" htmlFor="nickname">
          Apelido nos rankings
        </label>
        <input id="nickname" name="nickname" className="input" defaultValue={nickname} required minLength={3} maxLength={24} />
      </div>
      <div>
        <label className="label" htmlFor="schoolId">
          Faculdade (opcional)
        </label>
        <select id="schoolId" name="schoolId" className="select" defaultValue={schoolId ?? ""}>
          <option value="">Prefiro não informar</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
              {school.uf ? ` (${school.uf})` : ""}
            </option>
          ))}
        </select>
      </div>
      <label style={{ display: "flex", gap: 8, fontSize: 14.5 }}>
        <input type="checkbox" name="showSchool" defaultChecked={showSchool} />
        Mostrar minha faculdade ao lado do meu apelido
      </label>
      {state.error && <div className="alert alert-error" role="alert">{state.error}</div>}
      {state.notice && <div className="alert alert-ok" role="status">{state.notice}</div>}
      <button className="btn btn-primary" disabled={pending}>
        Salvar
      </button>
    </form>
  );
}

export function WithdrawButton() {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div>
      {!confirming ? (
        <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirming(true)}>
          Desistir e receber o valor de volta
        </button>
      ) : (
        <div className="card-2">
          <p style={{ marginBottom: 8, fontSize: 14.5 }}>A assinatura será cancelada agora, o acesso pago termina e o valor volta para o seu cartão. Confirma?</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
              Manter assinatura
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                const result = await withdrawAction();
                setPending(false);
                setConfirming(false);
                setMessage(result.ok ? { ok: true, text: "Pronto. O reembolso foi solicitado e pode levar alguns dias para aparecer na fatura." } : { ok: false, text: result.message });
              }}
            >
              Confirmar desistência
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

export function BoletimForm({ current }: { current: { score: number } | null }) {
  const [state, action, pending] = useActionState(saveBoletimAction, {});
  return (
    <form action={action} style={{ display: "grid", gap: 10 }}>
      <div className="grid-2">
        <div>
          <label className="label" htmlFor="score">
            Sua nota no ENAMED 2026
          </label>
          <input id="score" name="score" className="input" inputMode="decimal" required defaultValue={current?.score ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="proficient">
            Resultado
          </label>
          <select id="proficient" name="proficient" className="select" defaultValue="">
            <option value="">Não informar</option>
            <option value="sim">Proficiente</option>
            <option value="nao">Não proficiente</option>
          </select>
        </div>
      </div>
      <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "flex-start" }}>
        <input type="checkbox" name="consent" required style={{ marginTop: 4 }} />
        <span>Autorizo o uso dessa nota, de forma agregada, para calibrar o Termômetro de Proficiência. Posso retirar a autorização quando quiser.</span>
      </label>
      {state.error && <div className="alert alert-error" role="alert">{state.error}</div>}
      {state.notice && <div className="alert alert-ok" role="status">{state.notice}</div>}
      <button className="btn btn-ghost" disabled={pending}>
        Enviar nota
      </button>
    </form>
  );
}
