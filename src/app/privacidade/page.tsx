import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Privacidade" };

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="wrap-wide prose" style={{ maxWidth: 760 }}>
        <h1 style={{ fontSize: 32 }}>Política de privacidade</h1>
        <div className="adm-note" style={{ margin: "10px 0" }}>
          Minuta. Precisa de revisão por advogado e do nome do encarregado de dados antes do lançamento.
        </div>
        <h2>Dados que tratamos</h2>
        <ul>
          <li>Conta: e-mail, apelido e, se você informar, faculdade.</li>
          <li>Estudo: respostas, tempo, confiança, motivo de erro, comentários e pontuação.</li>
          <li>Pagamento: a Stripe processa os dados do cartão. Guardamos apenas o status da assinatura e o histórico de cobranças.</li>
          <li>Nota do boletim: só se você decidir enviar, com consentimento específico.</li>
        </ul>
        <h2>Para que usamos</h2>
        <ul>
          <li>Prestar o serviço: corrigir questões, calcular progresso e rankings.</li>
          <li>Melhorar o conteúdo: estatísticas de cada questão, sempre agregadas.</li>
          <li>Calibrar o Termômetro de Proficiência, usando a nota do boletim apenas com o seu consentimento.</li>
        </ul>
        <h2>O que os outros veem</h2>
        <p>
          Nos rankings aparece só o seu apelido. A faculdade só aparece ao lado do apelido se você permitir. A Liga das Faculdades mostra apenas médias de
          instituições com pelo menos 5 alunos ativos.
        </p>
        <h2>Com quem compartilhamos</h2>
        <p>Fornecedores necessários para o serviço: hospedagem e banco de dados (Vercel, Supabase) e pagamentos (Stripe). Não vendemos dados.</p>
        <h2>Seus direitos (LGPD)</h2>
        <p>
          Você pode corrigir seus dados na conta, retirar o consentimento da nota do boletim e excluir a conta a qualquer momento, o que apaga seus dados
          de estudo. Registros de pagamento podem ser mantidos pelo prazo exigido em lei. Contato do encarregado: [a preencher].
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
