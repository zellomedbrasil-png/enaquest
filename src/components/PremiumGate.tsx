import Link from "next/link";

export function PremiumGate({ title, text }: { title: string; text: string }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <p className="eyebrow">Assinatura</p>
      <h1 style={{ fontSize: 26, margin: "6px 0" }}>{title}</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        {text}
      </p>
      <Link href="/assinar" className="btn btn-primary">
        Assinar por R$ 29 por mês
      </Link>
      <p className="dim" style={{ fontSize: 13.5, marginTop: 10 }}>
        O Plantão do Dia continua grátis. Cancele quando quiser.
      </p>
    </div>
  );
}
