import Link from "next/link";
import { listLots } from "@/lib/server/editorial";

const STATUS: Record<string, string> = {
  pending_review: "Aguardando revisão",
  approved: "Aprovado",
  held: "Segurado por erro crítico",
  rejected: "Rejeitado",
};

export default async function AdminHome() {
  const lots = await listLots();
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="adm-note">
        Sem nenhum erro crítico em 59 questões sorteadas, há 95% de confiança de que menos de 5% do lote tem esse tipo de erro. Um erro crítico segura o lote
        inteiro. Questões com ressalva não vão ao ar até serem corrigidas.
      </div>
      {lots.length === 0 && <p className="muted">Nenhum lote importado ainda.</p>}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {lots.map((lot: any) => (
        <Link key={lot.id} href={`/admin/lotes/${lot.id}`} className="card" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <strong>{lot.id}</strong>
            <span className="pill">{STATUS[lot.status]}</span>
          </div>
          <p className="muted" style={{ fontSize: 14 }}>
            {lot.questionCount} questões · amostra de {lot.sampled || Math.min(lot.sample_size, lot.questionCount)} · {lot.decided} decididas · {lot.critical} críticas
          </p>
          {lot.notes && <p className="dim" style={{ fontSize: 13.5 }}>{lot.notes}</p>}
        </Link>
      ))}
    </div>
  );
}
