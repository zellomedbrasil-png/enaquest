import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { currentUser } from "@/lib/server/session";
import { MarketingHeader } from "../MarketingHeader";
import brand from "../landing.module.css";
import tools from "../ferramentas/tools.module.css";
import s from "./metodo.module.css";

export const metadata: Metadata = {
  title: "O método do EnaQuest",
  description:
    "Como o EnaQuest usa prática de recuperação, revisão espaçada, feedback imediato e metacognição em cada questão do ENAMED e do ENARE.",
};

const WITHOUT = [
  "Lê o resumo e acha que sabe, sem se testar",
  "Revê tudo de novo quando sobra tempo",
  "Confere só o gabarito e segue",
  "Não sabe se acertou por saber ou por sorte",
  "Monta o cronograma na mão e abandona na segunda semana",
  "Descobre o ponto fraco no dia da prova",
];

const WITH = [
  "Responde primeiro e só depois vê a explicação",
  "Revê cada erro no dia em que ele está para ser esquecido",
  "Lê por que a certa é certa e por que cada errada é errada",
  "Marca certeza, dúvida ou chute antes de responder",
  "Recebe o dia montado pelo tempo que tem",
  "Vê o acerto por área e treina onde está pior",
];

const PRINCIPLES = [
  {
    title: "Prática de recuperação",
    text: "Puxar a resposta da memória fixa mais do que reler. Errar tentando também ensina, porque a correção chega quando você já pensou no assunto.",
    here: "Você responde antes de ver qualquer explicação, no Plantão, no Treino e na Revisão.",
  },
  {
    title: "Revisão espaçada",
    text: "A gente esquece rápido o que viu uma vez. Rever no intervalo certo, cada vez mais longo, segura o conteúdo com menos tempo de estudo.",
    here: "Cada erro, e cada acerto no chute ou na dúvida, ganha uma data para voltar, calculada questão por questão.",
  },
  {
    title: "Feedback imediato",
    text: "O erro corrigido na hora é mais fácil de entender do que o erro descoberto semanas depois, no simulado.",
    here: "O comentário vem em camadas: a resposta curta, o raciocínio e o motivo de cada alternativa errada.",
  },
  {
    title: "Metacognição",
    text: "Saber o que você sabe é uma habilidade. Quem confunde sorte com domínio estuda o tema errado.",
    here: "Antes de responder, você marca certeza, dúvida ou chute. A Evolução mostra se a sua confiança acerta.",
  },
];

const PILLARS = [
  {
    title: "Seu dia, montado para o tempo que você tem",
    text: "Diga quantos minutos tem e qual prova vai fazer. O dia sai pronto: Plantão, revisões vencidas, erros para refazer e questões novas, com mais peso nas áreas em que você vai pior.",
    tags: ["Seu dia", "Prova-alvo", "Reta final com simulado"],
  },
  {
    title: "Treino do seu jeito",
    text: "Escolha a área, o tema, a origem (questões EnaQuest ou prova oficial), a dificuldade e quais questões: só as novas, as que errou, as que acertou sem certeza ou as marcadas.",
    tags: ["Filtro por área e tema", "Provas oficiais", "Dificuldade"],
  },
  {
    title: "Revisão que volta na hora certa",
    text: "O que você errou ou acertou sem certeza volta quando está para ser esquecido. Acertou de novo, o intervalo cresce. Errou, ele encurta.",
    tags: ["Revisão espaçada", "Agenda da semana"],
  },
  {
    title: "Caderno de erros com o motivo",
    text: "Cada erro fica guardado com o tema e o motivo que você marcou: conteúdo, leitura, pressa, chute ou dúvida entre duas. O padrão dos seus erros aparece sozinho.",
    tags: ["Caderno de erros", "Motivo do erro"],
  },
  {
    title: "Evolução por área",
    text: "Acerto por área, rating que sobe e desce a cada questão e uma estimativa de proficiência que só aparece quando há respostas suficientes para ser honesta.",
    tags: ["Termômetro de proficiência", "Calibração da confiança"],
  },
];

export default async function MethodPage() {
  const user = await currentUser();
  return (
    <div className={brand.page}>
      <MarketingHeader signedIn={Boolean(user)} method />
      <main className={tools.main}>
        <header className={tools.intro}>
          <p className={tools.kicker}>Método</p>
          <h1>
            Cada questão conta. <em>Com método.</em>
          </h1>
          <p className={tools.lead}>
            Esforço sem estratégia vira cansaço. O EnaQuest aplica, em cada questão do ENAMED e do ENARE, princípios bem estudados da psicologia cognitiva. Você
            responde e a plataforma organiza o resto.
          </p>
          <div className={tools.actions} style={{ marginTop: 18 }}>
            <Link href={user ? "/app" : "/cadastrar"} className={tools.primary}>
              {user ? "Abrir o app" : "Começar grátis"} <span aria-hidden="true">→</span>
            </Link>
            <Link href="/ferramentas/teste-de-nivel" className={tools.secondary}>
              Fazer o teste de nível
            </Link>
          </div>
        </header>

        <section className={s.section} aria-labelledby="dois-jeitos">
          <p className={tools.kicker}>Sem método e com método</p>
          <h2 id="dois-jeitos" className={s.title}>
            Dois jeitos de estudar para a mesma prova
          </h2>
          <div className={s.compare}>
            <div className={s.without}>
              <h3>Estudando sozinho</h3>
              <ul>
                {WITHOUT.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={s.with}>
              <h3>Com o EnaQuest</h3>
              <ul>
                {WITH.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className={s.section} aria-labelledby="por-que">
          <p className={tools.kicker}>Base científica</p>
          <h2 id="por-que" className={s.title}>
            Por que funciona
          </h2>
          <p className={s.sub}>Quatro ideias da ciência da aprendizagem, cada uma ligada a algo que você faz no app.</p>
          <div className={s.principles}>
            {PRINCIPLES.map((item) => (
              <article key={item.title} className={s.principle}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <p className={s.here}>
                  <strong>No EnaQuest:</strong> {item.here}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className={s.section} aria-labelledby="pilares">
          <p className={tools.kicker}>Os pilares</p>
          <h2 id="pilares" className={s.title}>
            O que acontece com cada questão que você responde
          </h2>
          <ol className={s.pillars}>
            {PILLARS.map((item, index) => (
              <li key={item.title} className={s.pillar}>
                <span className={s.num}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <ul className={s.tags}>
                    {item.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.section} aria-labelledby="habito">
          <p className={tools.kicker}>Constância</p>
          <h2 id="habito" className={s.title}>
            Método só funciona se você volta amanhã
          </h2>
          <p className={s.sub}>
            Por isso o EnaQuest é um jogo: o Plantão do Dia tem 10 questões iguais para todo mundo, a sequência de dias tem trocas de plantão para os dias
            difíceis, e a liga semanal coloca você para disputar com a sua turma e a sua faculdade. O Plantão do Dia é sempre grátis.
          </p>
        </section>

        <section className={s.cta} aria-labelledby="pronto">
          <div>
            <h2 id="pronto">Pronto para estudar com método?</h2>
            <p>Comece grátis com o Plantão do Dia. A assinatura libera Seu dia completo, Treino, Revisão e Simulados por R$ 29 por mês, sem fidelidade.</p>
          </div>
          <div className={tools.actions}>
            <Link href={user ? "/app" : "/cadastrar"} className={tools.primary}>
              {user ? "Abrir o app" : "Começar grátis"} <span aria-hidden="true">→</span>
            </Link>
            <Link href="/planos" className={tools.secondary}>
              Ver planos
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
