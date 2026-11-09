import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="wrap-wide prose" style={{ maxWidth: 760 }}>
        <h1 style={{ fontSize: 32 }}>Termos de uso</h1>
        <div className="adm-note" style={{ margin: "10px 0" }}>
          Minuta. Precisa de revisão por advogado e dos dados da empresa antes do lançamento.
        </div>
        <h2>1. O que é o EnaQuest</h2>
        <p>
          Plataforma de estudo por questões para a preparação para o ENAMED e o ENARE. É um produto independente, sem vínculo com o Inep, o MEC, o HU
          Brasil ou a FGV. Prestador: [razão social e CNPJ a preencher].
        </p>
        <h2>2. Conteúdo educacional</h2>
        <p>
          O conteúdo serve para estudo e não é orientação clínica. Não substitui protocolos vigentes nem a avaliação de um profissional. Não prometemos
          aprovação, nota ou classificação.
        </p>
        <p>
          As questões originais são criadas com apoio de inteligência artificial e passam por verificações. Cada questão indica como foi verificada, e
          apenas parte delas é lida individualmente por médico. Erros podem existir: use os canais de denúncia e recurso.
        </p>
        <h2>3. Conta e uso</h2>
        <ul>
          <li>A conta é pessoal e não pode ser compartilhada.</li>
          <li>É proibido copiar o banco de questões em massa ou usar automação para responder.</li>
          <li>Comentários devem respeitar as pessoas e não podem conter dados de pacientes. Podemos remover conteúdo inadequado.</li>
        </ul>
        <h2>4. Assinatura e pagamento</h2>
        <ul>
          <li>A assinatura custa R$ 29 por mês e renova automaticamente no cartão de crédito até ser cancelada.</li>
          <li>Você pode cancelar a qualquer momento na sua conta. O acesso continua até o fim do período já pago.</li>
          <li>
            Direito de arrependimento: até 7 dias após o primeiro pagamento, você pode desistir pela página da conta e receber o valor de volta (Código
            de Defesa do Consumidor, art. 49).
          </li>
          <li>Se uma cobrança falhar, avisamos e tentamos de novo. O acesso é mantido por até 3 dias após o vencimento.</li>
        </ul>
        <h2>5. Contato</h2>
        <p>[e-mail de atendimento a preencher]</p>
      </main>
      <SiteFooter />
    </>
  );
}
