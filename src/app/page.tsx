import Image from "next/image";
import { AccessLabel } from "./AccessLabel";
import { MarketingHeader } from "./MarketingHeader";
import { ReelPlayer } from "./ReelPlayer";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { LEVELS, XP } from "@/lib/game/xp";
import { currentUser } from "@/lib/server/session";
import { CompanionShowcase } from "./CompanionShowcase";
import s from "./landing.module.css";

const features = [
  ["Plantão do Dia", "Resolva as mesmas dez questões que a turma e compare seu resultado ao fim do plantão.", "diario"],
  ["Comentário em camadas", "Vá da resposta curta ao raciocínio clínico e descubra por que cada alternativa faz sentido ou falha.", "comentario"],
  ["Liga das Faculdades", "Some XP para sua faculdade. A classificação considera a média por aluno ativo.", "liga"],
] as const;

function PixelIcon({ kind }: { kind: "diario" | "comentario" | "liga" }) {
  const paths = {
    diario: "M7 2h10v3h4v17H3V5h4zm2 2v3h6V4zm-4 4v12h14V8h-2v1H7V8zm6 3h2v2h3v2h-3v3h-2v-3H8v-2h3z",
    comentario: "M2 3h20v14h-9l-6 5v-5H2zm3 3v8h5v3l3-3h6V6zm2 2h10v2H7zm0 3h6v2H7z",
    liga: "M6 2h12v3h5v7h-3v2h-4v2h-3v3h4v3H7v-3h4v-3H8v-2H4v-2H1V5h5zm-3 5v3h2v2h2L6 7zm15 0-1 5h2v-2h2V7z",
  };
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d={paths[kind]} /></svg>;
}

const questions = [
  ["Como funciona o Plantão do Dia?", "Você e sua turma recebem as mesmas dez questões. Depois de responder, você pode ler o comentário de cada alternativa, discutir o caso e comparar seu resultado com o da turma."],
  ["O que posso fazer de graça?", "O plantão é gratuito todos os dias, com comentários e discussão das questões. Você também ganha XP, mantém sua sequência de estudos e participa da Liga das Faculdades. Basta criar uma conta, sem cartão."],
  ["O que a assinatura acrescenta?", "Por R$ 29 ao mês, você pode montar treinos por área, fazer simulados completos e acompanhar seu desempenho no Termômetro de Proficiência. A assinatura também inclui o caderno de erros e a revisão espaçada."],
  ["Como volto às questões que errei?", "Registre o motivo do erro depois de responder. Na assinatura, você pode consultar seu caderno de erros. A revisão espaçada traz de volta tanto as questões que você errou quanto aquelas que acertou com dúvida."],
  ["Como as questões são revisadas?", "As questões são criadas com IA, passam por checagem independente e incluem fontes. Um médico revisa uma amostra de cada lote. O selo “Revisada por médico” identifica as questões lidas por um médico. Se encontrar um erro, você pode sinalizá-lo no aplicativo."],
];

export default async function LandingPage() {
  const user = await currentUser();
  const start = user ? "/app" : "/cadastrar";
  return (
    <div className={s.page}>
      <MarketingHeader signedIn={Boolean(user)} />
      <main>
        <section className={s.cover}>
          <Image src="/campanha/plantao.webp" alt="" fill priority sizes="(max-width: 650px) 900px, 100vw" className={s.coverPhoto} />
          <div className={s.coverInner}>
            <p className={s.label}>Preparação para ENAMED e ENARE</p>
            <h1>Treine como é a prova.<br /><em>Um plantão por dia.</em></h1>
            <p className={s.lead}>Dez questões para resolver hoje. Comentários para entender cada alternativa. E uma turma inteira no mesmo plantão.</p>
            <div className={s.actions}><Link className={s.primary} href={start}><AccessLabel>{user ? "Ir para meu plantão" : "Começar grátis"}</AccessLabel> <span aria-hidden="true">→</span></Link><ReelPlayer /></div>
            <p className={s.note}>Plantão do Dia gratuito · Sem cartão de crédito · <Link href="/ferramentas/teste-de-nivel">Faça o teste de nível grátis</Link></p>
          </div>
        </section>
        <section id="recursos" className={s.section}><p className={s.label}>A plataforma</p><h2>O que você encontra no plantão</h2>
          <div className={s.cards}>{features.map(([name, text, kind]) => <article key={kind}><div className={s.icon}><PixelIcon kind={kind} /></div><h3>{name}</h3><p>{text}</p></article>)}</div>
        </section>
        <section id="metodo" className={s.method}>
          <div className={s.studyImage}><Image src="/campanha/estudo.webp" fill sizes="(max-width: 650px) 90vw, 45vw" alt="Caderno de estudos com anotações, lápis e estetoscópio" /></div>
          <div className={s.methodCopy}><p className={s.label}>Como funciona</p><h2>Da primeira hipótese à próxima revisão.</h2>
            <ol>
              <li><strong>Teste seu raciocínio</strong><p>Leia o caso, escolha uma alternativa e marque o quanto está confiante na resposta.</p></li>
              <li><strong>Entenda onde acertou ou errou</strong><p>Confira a explicação e registre o motivo do erro. Foi uma lacuna no conteúdo ou um detalhe do enunciado?</p></li>
              <li><strong>Retome o que precisa de atenção</strong><p>Na assinatura, o caderno de erros e a revisão espaçada trazem esses temas de volta ao treino.</p></li>
            </ol>
          </div>
        </section>
        <section id="jornada" className={s.team} aria-labelledby="titulo-jornada">
          <div className={s.journeyCopy}>
            <p className={s.label}>Sua jornada</p>
            <h2 id="titulo-jornada">Um companheiro para cada plantão.</h2>
            <p>Escolha entre oito médicos. Durante uma questão, seu companheiro pode convidar você a respirar por um instante. Depois da resposta, ele ajuda a pensar em qual pista do caso fez a diferença.</p>
            <div className={s.caseNote}>
              <h3>Um exemplo do banco de questões</h3>
              <p>Um paciente chega à UBS no quinto dia de febre, agora com dor abdominal e vômitos. Você escolhe a conduta e indica sua confiança. O comentário explica quais dados do caso orientam a decisão e por que cada alternativa foi aceita ou descartada.</p>
            </div>
          </div>
          <CompanionShowcase />
          <div className={s.progression}>
            <h3>Como o jogo acompanha seu estudo</h3>
            <dl>
              <div><dt>Raciocínio e revisão</dt><dd>Passou por cima de uma pista do enunciado? Registre o motivo do erro e ganhe {XP.errorDiagnosed} XP. Na assinatura, a questão volta na revisão espaçada para você tentar de novo.</dd></div>
              <div><dt>Missões e níveis</dt><dd>Completar o Plantão do Dia rende {XP.dailyComplete} XP. O XP se acumula entre os plantões. Ao chegar a {LEVELS[1].min} XP, você passa de {LEVELS[0].name} para {LEVELS[1].name}.</dd></div>
              <div><dt>Sequências e conquistas</dt><dd>Volte a estudar nos dias seguintes. Ao completar sete dias de sequência, você desbloqueia a conquista “Semana de plantão”. Na Liga das Faculdades, seu XP também conta para a média da sua turma.</dd></div>
            </dl>
          </div>
        </section>
        <section id="duvidas" className={s.faq} aria-labelledby="titulo-duvidas">
          <div className={s.faqIntro}>
            <Image src="/campanha/estudo.webp" fill sizes="(max-width: 740px) 90vw, 390px" alt="" />
            <div className={s.faqIntroText}>
              <p className={s.label}>Antes de começar</p>
              <h2 id="titulo-duvidas">Dúvidas frequentes</h2>
              <Link href="/planos">Comparar planos <span aria-hidden="true">→</span></Link>
            </div>
          </div>
          <div className={s.faqList}>
            {questions.map(([question, answer], index) => (
              <details key={question} name="duvidas-enaquest" open={index === 0}>
                <summary>{question}<span className={s.toggle} aria-hidden="true" /></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
