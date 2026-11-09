import Link from "next/link";

export function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", marginTop: 48, padding: "24px 0" }}>
      <div className="wrap-wide muted" style={{ fontSize: 13.5 }}>
        <p>
          O EnaQuest é um produto independente, sem vínculo com o Inep, o MEC, o HU Brasil ou a FGV. ENAMED e ENARE são citados só para
          indicar o exame a que o conteúdo se refere. Não prometemos aprovação nem nota.
        </p>
        <p style={{ marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/termos">Termos de uso</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/planos">Planos</Link>
        </p>
      </div>
    </footer>
  );
}
