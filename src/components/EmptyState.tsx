import type { ReactNode } from "react";
import { MyMascot } from "./MyMascot";

/** Tela ou bloco sem conteúdo ainda: o mascote explica o que fazer, em vez de só um texto solto. */
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card empty-state">
      <MyMascot mood="dormindo" size={96} background />
      <div>
        <h2 style={{ fontSize: 18 }}>{title}</h2>
        <p className="muted">{children}</p>
        {action && <div style={{ marginTop: 10 }}>{action}</div>}
      </div>
    </div>
  );
}
