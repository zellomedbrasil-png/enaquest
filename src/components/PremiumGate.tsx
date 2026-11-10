import Link from "next/link";
import { MyMascot } from "./MyMascot";

export function PremiumGate({ title, text }: { title: string; text: string }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ display: "grid", justifyItems: "center", marginBottom: 6 }}>
        <MyMascot mood="neutro" size={104} background />
      </div>
      <p className="eyebrow">Assinatura</p>
      <h1 style={{ fontSize: 26, margin: "6px 0" }}>{title}</h1>
      <p className="muted" style={{ marginBottom: 14 }}>
        {text}
      </p>
      <ul className="gate-list">
        <li>Revisão que traz de volta o que você errou, na hora certa</li>
        <li>Treino por área, no tamanho de rodada que você escolher</li>
        <li>Simulados completos e Termômetro de Proficiência</li>
      </ul>
      <Link href="/assinar" className="btn btn-primary">
        Assinar por R$ 29 por mês
      </Link>
      <p className="dim" style={{ fontSize: 13.5, marginTop: 10 }}>
        O Plantão do Dia continua grátis. Cancele quando quiser.
      </p>
    </div>
  );
}
