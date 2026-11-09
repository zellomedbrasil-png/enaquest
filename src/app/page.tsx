import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const FEATURES = [
  {
    title: "Termômetro de Proficiência",
    text: "Uma estimativa do seu nível por área, com faixa de incerteza. Usa o mesmo tipo de modelo estatístico da prova, sem fingir precisão que ainda não tem.",
  },
  {
    title: "Liga das Faculdades",
    text: "Sua turma contra as outras. O ranking usa a média por aluno ativo, para a escola grande não vencer só pelo tamanho.",
  },
  {
    title: "Comentário em camadas",
    text: "Resposta em 20 segundos, raciocínio clínico, o erro de cada alternativa, macete, armadilha clássica e fonte com data.",
  },
  {
    title: "Diagnóstico do erro",
    text: "Marque a confiança antes de responder e o motivo depois de errar. Saiba se o problema é conteúdo, leitura ou pressa.",
  },
  {
    title: "Revisão que volta na hora certa",
    text: "O que você errou ou acertou sem certeza retorna em intervalos calculados, em vez de ficar esquecido num caderno.",
  },
  {
    title: "Simulado Nacional",
    text: "100 questões, 4 alternativas e 5 horas, com a proporção por área medida na prova real. Percentil nacional e por faculdade.",
  },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="wrap-wide" style={{ paddingTop: 28, paddingBottom: 28 }}>
          <div className="hero-grid">
            <div>
              <p className="eyebrow">ENAMED e ENARE acesso direto</p>
              <h1 style={{ fontSize: "clamp(34px, 6vw, 56px)", margin: "8px 0 14px" }}>Treine como é a prova. Volte porque é divertido.</h1>
              <p className="muted" style={{ fontSize: 18, maxWidth: 560 }}>
                Questões no formato real do ENAMED, comentários que ensinam de verdade e uma competição entre plantonistas que faz você abrir o
                app todo dia.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
                <Link href="/cadastrar" className="btn btn-primary">
                  Começar grátis
                </Link>
                <Link href="/planos" className="btn btn-ghost">
                  Ver planos
                </Link>
              </div>
              <p className="dim" style={{ fontSize: 13.5, marginTop: 10 }}>
                O Plantão do Dia é sempre grátis. Não pedimos cartão para começar.
              </p>
            </div>
            <div className="card" aria-hidden style={{ transform: "rotate(1deg)" }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <span className="pill">
                  <i className="area-dot" style={{ background: "#b39dff" }} /> Saúde Mental
                </span>
                <span className="pill">UBS</span>
              </div>
              <div className="display" style={{ fontSize: 20 }}>
                Plantão do Dia
              </div>
              <p className="muted" style={{ fontSize: 14, margin: "4px 0 12px" }}>
                As mesmas 10 questões para todo mundo. Quem foi melhor hoje?
              </p>
              <div className="rows">
                {[
                  ["1", "plantonista_ana", "10/10"],
                  ["2", "residente_sonhador", "9/10"],
                  ["3", "você", "9/10"],
                ].map(([position, name, score]) => (
                  <div key={position} className={`row-board ${name === "você" ? "me" : ""}`}>
                    <span className="display">{position}</span>
                    <span>{name}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{score}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <span className="pill">+42 XP</span>
                <span className="pill">12 dias de sequência</span>
                <span className="pill">Patente Ouro</span>
              </div>
            </div>
          </div>
        </section>

        <section className="wrap-wide" style={{ paddingTop: 20 }}>
          <h2 style={{ fontSize: 30, marginBottom: 14 }}>O que muda no seu estudo</h2>
          <div className="feature-grid">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card">
                <h3 style={{ fontSize: 18, marginBottom: 6 }}>{feature.title}</h3>
                <p className="muted" style={{ fontSize: 15 }}>
                  {feature.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap-wide" style={{ paddingTop: 30 }}>
          <div className="card">
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>Sem caixa-preta no conteúdo</h2>
            <p className="muted">
              As questões são criadas com IA e passam por checagem independente e fontes obrigatórias. Depois, um médico revisa uma amostra sorteada de
              cada lote. Toda questão mostra qual foi o caminho dela, e só recebe o selo &quot;Revisada por médico&quot; a que um médico realmente leu.
              Achou erro? Denuncie ou entre com recurso: excesso de denúncias tira a questão do ar automaticamente.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
