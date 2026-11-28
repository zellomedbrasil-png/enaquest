import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Privacidade" };

const CONTACT = "contato@enaquest.com";

export default function PrivacyPage() {
  const contact = <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;
  return (
    <>
      <SiteHeader />
      <main className="wrap-wide prose" style={{ maxWidth: 760 }}>
        <h1 style={{ fontSize: 32 }}>Política de privacidade</h1>
        <p className="muted">Última atualização: 27 de novembro de 2026.</p>
        <p>
          Esta política explica como o EnaQuest (enaquest.com) trata os seus dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei nº
          13.709/2018, a LGPD). O EnaQuest é o controlador desses dados. Para qualquer assunto sobre privacidade, escreva para {contact}.
        </p>

        <h2>1. Dados que tratamos</h2>
        <ul>
          <li>
            <strong>Conta Google:</strong> a entrada é feita só com o Google. Recebemos seu nome, e-mail, foto de perfil e o identificador da conta.
            Não recebemos sua senha e não acessamos seu Gmail, Drive, agenda ou contatos.
          </li>
          <li>
            <strong>Perfil:</strong> apelido, faculdade (se você informar), metas de estudo, prova pretendida, data da prova e escolhas do mascote.
          </li>
          <li>
            <strong>Estudo:</strong> respostas, tempo, confiança, motivo de erro, revisões, simulados, pontos, conquistas, ligas e turmas.
          </li>
          <li>
            <strong>Participação:</strong> comentários, votos, avaliações de questões, denúncias e recursos que você enviar.
          </li>
          <li>
            <strong>Assinatura:</strong> os dados do cartão são tratados pela Stripe e não passam pelo nosso banco. Guardamos a identificação do
            cliente na Stripe, o status da assinatura e o histórico de cobranças.
          </li>
          <li>
            <strong>Nota do boletim:</strong> só se você decidir enviar, com consentimento específico.
          </li>
          <li>
            <strong>Dados técnicos:</strong> os servidores registram informações de acesso, como endereço IP, navegador, data e hora. No teste de nível
            sem cadastro, usamos um código derivado do endereço IP para limitar abusos.
          </li>
        </ul>

        <h2>2. Para que usamos e com qual base legal</h2>
        <ul>
          <li>Criar sua conta, corrigir questões, calcular progresso, rankings e cobrar a assinatura: execução do contrato com você.</li>
          <li>Proteger o serviço contra abuso e fraude e melhorar o conteúdo com estatísticas agregadas: legítimo interesse.</li>
          <li>Calibrar o Termômetro de Proficiência com a nota do boletim: seu consentimento, que pode ser retirado quando quiser.</li>
          <li>Guardar registros exigidos por lei, como os fiscais e de pagamento: cumprimento de obrigação legal.</li>
        </ul>

        <h2>3. Dados recebidos do Google</h2>
        <p>
          Usamos os dados da sua conta Google apenas para identificar você e permitir o acesso ao EnaQuest. Não vendemos esses dados, não os usamos para
          publicidade e não os usamos para treinar modelos de inteligência artificial. O uso segue a{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">Política de Dados do Usuário dos Serviços de API do Google</a>,
          incluindo os requisitos de uso limitado. Você pode remover o acesso do EnaQuest nas configurações da sua Conta Google.
        </p>

        <h2>4. O que os outros veem</h2>
        <p>
          Nos rankings aparece o seu apelido. A faculdade só aparece ao lado do apelido se você permitir. A Liga das Faculdades mostra apenas médias de
          instituições com pelo menos 5 alunos ativos. Comentários que você publicar podem ser vistos por outros alunos. Não inclua neles dados de
          pacientes nem informações pessoais de terceiros.
        </p>

        <h2>5. Com quem compartilhamos</h2>
        <p>Usamos fornecedores necessários para o serviço funcionar:</p>
        <ul>
          <li>Google: entrada na conta.</li>
          <li>Supabase: banco de dados e autenticação.</li>
          <li>Vercel: hospedagem do site.</li>
          <li>Stripe: pagamentos.</li>
        </ul>
        <p>
          Também podemos fornecer dados quando a lei ou uma ordem de autoridade competente exigir. Não vendemos dados pessoais. Esses fornecedores
          podem tratar dados fora do Brasil, inclusive nos Estados Unidos, observadas as regras da LGPD para transferência internacional.
        </p>

        <h2>6. Cookies e armazenamento no seu aparelho</h2>
        <p>
          Usamos cookies necessários para manter você conectado. Preferências como tema, tamanho do texto, sons e dicas já vistas ficam guardadas no
          próprio aparelho. Não usamos cookies de publicidade.
        </p>

        <h2>7. Por quanto tempo guardamos</h2>
        <p>
          Guardamos os dados enquanto sua conta existir. Você pode excluí-la na página da conta, o que apaga o perfil, o histórico de estudo e os
          comentários. Se tiver assinatura ativa, cancele antes de excluir. Registros de pagamento e de acesso podem ser mantidos, inclusive pelos
          fornecedores, pelo prazo exigido em lei.
        </p>

        <h2>8. Segurança</h2>
        <p>
          A conexão com o site é criptografada e o acesso aos dados é restrito. Nenhum sistema é totalmente seguro. Se ocorrer um incidente que possa
          causar risco ou dano relevante, avisaremos os afetados e a autoridade, como manda a LGPD.
        </p>

        <h2>9. Seus direitos</h2>
        <p>
          Você pode pedir a confirmação do tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade,
          informação sobre compartilhamento e revogação do consentimento, além de se opor a tratamentos feitos em desacordo com a lei. Escreva para{" "}
          {contact}. Podemos pedir uma confirmação de identidade antes de atender. Você também pode reclamar à Autoridade Nacional de Proteção de Dados
          (ANPD).
        </p>

        <h2>10. Mudanças nesta política</h2>
        <p>Quando esta política mudar, atualizaremos a data no topo. Mudanças importantes serão avisadas no site.</p>
      </main>
      <SiteFooter />
    </>
  );
}
