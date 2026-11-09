import type { Metadata } from "next";
import Link from "next/link";
import { createGroupAction, joinGroupAction, leaveGroupAction } from "@/app/actions";
import { getLeagueView, type BoardRow } from "@/lib/server/leagues";
import { getProfile, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Ligas" };

function Board({ rows, promoteUntil = 0, demoteFrom = null }: { rows: BoardRow[]; promoteUntil?: number; demoteFrom?: number | null }) {
  return (
    <div className="rows" style={{ gap: 2 }}>
      {rows.map((row) => {
        const zone = row.position <= promoteUntil ? "sobe" : demoteFrom !== null && row.position >= demoteFrom ? "desce" : null;
        return (
          <div key={row.position} className={`row-board ${row.me ? "me" : ""}`}>
            <span className="display">{row.position}</span>
            <span>
              {row.nickname}
              {zone === "sobe" && <span className="pill" style={{ marginLeft: 6 }}>Sobe</span>}
              {zone === "desce" && <span className="pill" style={{ marginLeft: 6 }}>Desce</span>}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{row.xp} XP</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function LeaguesPage() {
  const user = await requireUser();
  const [view, profile] = await Promise.all([getLeagueView(user.id), getProfile(user.id)]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Ligas</h1>
        <p className="muted">Toda semana recomeça. O XP de segunda a domingo define quem sobe e quem desce.</p>
      </div>

      <section className="card">
        <p className="eyebrow">Sua liga</p>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>Liga {view.tierName}</h2>
        {view.member ? (
          <Board rows={view.table} promoteUntil={view.promoteUntil} demoteFrom={view.demoteFrom} />
        ) : (
          <p className="muted">Responda uma questão esta semana para entrar em um grupo.</p>
        )}
        {view.member && view.table.length < 10 && (
          <p className="dim" style={{ fontSize: 13.5, marginTop: 8 }}>
            Sobe e desce valem em grupos com pelo menos 10 pessoas.
          </p>
        )}
      </section>

      <section className="card">
        <p className="eyebrow">Liga das Faculdades</p>
        <h2 style={{ fontSize: 22, marginBottom: 4 }}>Média de XP por aluno ativo</h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 8 }}>
          Aparecem instituições com pelo menos 5 alunos ativos na semana. Assim, escola grande não vence só pelo tamanho.
        </p>
        {!profile.school_id && (
          <div className="alert alert-info" style={{ marginBottom: 8 }}>
            <Link href="/app/conta">Informe sua faculdade</Link> para somar pontos para ela. Seu nome não aparece nesse ranking.
          </div>
        )}
        {view.schools.length === 0 ? (
          <p className="muted">Nenhuma instituição atingiu o mínimo nesta semana.</p>
        ) : (
          <div className="rows" style={{ gap: 2 }}>
            {view.schools.map((school, i) => (
              <div key={school.name} className={`row-board ${school.mine ? "me" : ""}`}>
                <span className="display">{i + 1}</span>
                <span>
                  {school.name}
                  {school.uf ? ` (${school.uf})` : ""} <span className="dim">· {school.activeMembers} ativos</span>
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{school.avgXp}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <p className="eyebrow">Sua turma</p>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>Dispute com os amigos</h2>
        <div style={{ display: "grid", gap: 14 }}>
          {view.groups.map((group) => (
            <div key={group.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
                <strong>{group.name}</strong>
                <span className="pill">Código: {group.code}</span>
              </div>
              <Board rows={group.table} />
              <form action={leaveGroupAction} style={{ marginTop: 6 }}>
                <input type="hidden" name="groupId" value={group.id} />
                <button className="btn btn-ghost btn-sm">Sair da turma</button>
              </form>
            </div>
          ))}
          <div className="grid-2">
            <form action={createGroupAction} style={{ display: "grid", gap: 6 }}>
              <label className="label" htmlFor="group-name">
                Criar turma
              </label>
              <input id="group-name" name="name" className="input" minLength={3} maxLength={40} required placeholder="Internato 2027" />
              <button className="btn btn-ghost">Criar</button>
            </form>
            <form action={joinGroupAction} style={{ display: "grid", gap: 6 }}>
              <label className="label" htmlFor="group-code">
                Entrar com código
              </label>
              <input id="group-code" name="code" className="input" required maxLength={12} placeholder="A1B2C3D4" />
              <button className="btn btn-ghost">Entrar</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
