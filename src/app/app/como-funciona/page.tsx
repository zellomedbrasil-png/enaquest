import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/StudyIcons";
import { Banner, PageHeader, ToolIcon, type TOOL_ICON } from "@/components/ui";
import { buildJourney } from "@/lib/game/journey";
import { PLACEMENT_GAMES, START_RATING, TIERS } from "@/lib/game/rating";
import { MAX_SHIELDS, SHIELD_EVERY, todayBR } from "@/lib/game/streak";
import { LEVELS, XP } from "@/lib/game/xp";
import { getDailyState } from "@/lib/server/daily";
import { todayMissions } from "@/lib/server/progress";
import { isPremium, requireUser } from "@/lib/server/session";
import { countDueReviews } from "@/lib/server/study";

export const metadata: Metadata = { title: "Como funciona" };

type Cycle = {
  icon: keyof typeof TOOL_ICON;
  title: string;
  text: string;
  time: string;
  plan: "gratis" | "assinatura";
  href: string;
  cta: string;
};

/** O ciclo diário, na ordem em que o estudante percorre. */
const CYCLE: Cycle[] = [
  { icon: "plantao", title: "Plantão do Dia", text: "Dez questões iguais para todo mundo, todo dia. Responder já mantém sua sequência.", time: "10 questões", plan: "gratis", href: "/app/plantao", cta: "Abrir o Plantão" },
  { icon: "revisao", title: "Revisão", text: "O que você errou, chutou ou marcou volta no dia certo, antes de esquecer.", time: "o que voltou hoje", plan: "assinatura", href: "/app/revisao", cta: "Abrir a Revisão" },
  { icon: "treino", title: "Treino", text: "Você escolhe a área e o tamanho da rodada. Treinar também cumpre as missões do dia.", time: "você decide", plan: "assinatura", href: "/app/treino", cta: "Abrir o Treino" },
  { icon: "evolucao", title: "Evolução", text: "Seu rating, o acerto por área e como sua confiança se compara ao resultado.", time: "quando quiser", plan: "gratis", href: "/app/evolucao", cta: "Ver minha evolução" },
];

const QUESTION_STEPS: { title: string; text: string }[] = [
  { title: "Leia e escolha", text: "Toque numa alternativa ou use a tecla da letra. Use o ✕ para riscar as que você descartou." },
  { title: "Diga sua confiança", text: "Certeza, dúvida ou chute. É opcional, e é o que decide o que volta na sua Revisão." },
  { title: "Responda", text: "Toque em Responder ou aperte Enter. A correção aparece na hora." },
  { title: "Aprenda com o comentário", text: "Cada alternativa mostra por que está certa ou errada, e quatro cartões aprofundam o tema." },
];

const STUDY_CARDS: { icon: IconName; title: string; text: string }[] = [
  { icon: "book", title: "Revisão do tema", text: "A teoria por trás da questão, para quem ainda não estudou o assunto." },
  { icon: "bulb", title: "Dica de ouro", text: "O macete de prova e a armadilha clássica do tema." },
  { icon: "chat", title: "Como pensar", text: "O raciocínio clínico passo a passo e o que a prova quer de você." },
  { icon: "pill", title: "Resumo", text: "Os pontos principais em poucas linhas, para revisar rápido." },
];

const TOOLS: { icon: IconName; title: string; text: string }[] = [
  { icon: "marker", title: "Marca-texto", text: "Selecione trechos do enunciado para grifar. Selecione de novo para apagar." },
  { icon: "bulb", title: "Pista do mascote", text: "Antes de responder, peça uma pista clínica sem entregar o gabarito." },
  { icon: "target", title: "Mapa das questões", text: "Pule para qualquer questão da rodada e releia o comentário das já respondidas." },
  { icon: "bookmark", title: "Rever depois", text: "Marque uma questão para ela voltar na Revisão, mesmo que você tenha acertado." },
  { icon: "up", title: "Avaliar", text: "Diga se gostou da questão. Isso ajuda a equipe a melhorar o banco." },
  { icon: "flag", title: "Reportar", text: "Achou um erro ou algo desatualizado? Avise por ali." },
];

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Esqueci de estudar um dia. Perco a sequência?",
    a: (
      <>
        Depende. Você ganha uma <strong>troca de plantão</strong> a cada {SHIELD_EVERY} dias seguidos e guarda até {MAX_SHIELDS}. Se faltar um dia e tiver uma troca guardada, um colega cobre o plantão e a sequência continua. Sem troca, ela volta para 1.
      </>
    ),
  },
  {
    q: "Preciso fazer o Plantão inteiro para manter a sequência?",
    a: "Não. Basta responder pelo menos uma questão no dia. O Plantão completo rende XP extra.",
  },
  {
    q: "Por que meu rating caiu depois de errar?",
    a: `O rating mede seu nível, então errar uma questão fácil custa mais do que errar uma difícil. Nas primeiras ${PLACEMENT_GAMES} questões ele está calibrando e errar custa pouco. Refazer uma questão na Revisão não mexe no rating.`,
  },
  {
    q: "A confiança que eu marco muda minha nota?",
    a: "Não muda rating nem XP. Ela só serve para o app decidir o que voltar na Revisão: errar, chutar ou ficar em dúvida faz a questão voltar; acertar com certeza, não.",
  },
  {
    q: "Dá para treinar sem assinar?",
    a: "O Plantão do Dia é sempre grátis, com comentário completo. Treino, Revisão, Simulados e o Termômetro de Proficiência fazem parte da assinatura.",
  },
  {
    q: "O que acontece se eu errar muito no Plantão?",
    a: "Nada de ruim: não existe vida nem energia que acabe. As que você erra entram na Revisão para você fixar, e o dia seguinte começa limpo.",
  },
];

const GLOSSARY: { id: string; term: string; text: ReactNode }[] = [
  { id: "plantao", term: "Plantão", text: "As 10 questões do dia. Todo mundo recebe as mesmas, então dá para comparar seu resultado com a turma." },
  { id: "sequencia", term: "Sequência", text: "Quantos dias seguidos você respondeu pelo menos uma questão. Ela zera se você passar um dia sem estudar." },
  { id: "troca", term: "Troca de plantão", text: `Um colega cobre um dia em que você não estudou, e a sequência continua. Você ganha uma a cada ${SHIELD_EVERY} dias seguidos e guarda até ${MAX_SHIELDS}.` },
  { id: "xp", term: "XP e nível", text: "O XP mede seu esforço, não só o acerto. Os níveis vão de Doutorando a Preceptor." },
  { id: "rating", term: "Rating e patente", text: `O rating mede seu nível e começa em ${START_RATING}. Acertar questão difícil rende mais; errar questão fácil custa mais. A patente é a faixa do seu rating.` },
  { id: "liga", term: "Liga", text: "Um grupo de estudantes que disputa o XP da semana, de segunda a domingo. Quem fica no topo sobe de liga; quem fica no fim desce." },
  { id: "revisao", term: "Revisão", text: "Questões que você errou ou acertou sem certeza, de volta na hora certa. É o que mais ajuda a fixar." },
  { id: "confianca", term: "Confiança", text: "Antes de responder, você diz se tem certeza, dúvida ou vai chutar. É opcional e ajuda a escolher o que volta na Revisão." },
  { id: "mascote", term: "Companheiro de jornada", text: "Escolha um dos oito mascotes. Ele conversa com você durante as questões, revisões e simulados, e você troca quando quiser." },
];

const NAV = [
  ["ciclo", "Seu ciclo"],
  ["questao", "Dentro da questão"],
  ["pontos", "Pontos e evolução"],
  ["planos", "Grátis e assinatura"],
  ["duvidas", "Dúvidas"],
  ["glossario", "Glossário"],
] as const;

function Plan({ plan }: { plan: "gratis" | "assinatura" }) {
  return <span className={`hw-plan hw-plan-${plan}`}>{plan === "gratis" ? "Grátis" : "Assinatura"}</span>;
}

export default async function HowItWorksPage() {
  const user = await requireUser();
  const day = todayBR();
  const [premium, daily, missions, due] = await Promise.all([
    isPremium(user.id),
    getDailyState(user.id, day),
    todayMissions(user.id),
    countDueReviews(user.id),
  ]);
  const extra = missions.filter((m) => m.id !== "m_daily");
  const answered = Object.keys(daily.answered).length;
  const journey = buildJourney({
    premium,
    dailyTotal: daily.questions.length,
    dailyAnswered: answered,
    dailyHits: Object.values(daily.answered).filter((a) => a.correct).length,
    dueReviews: due,
    extraMissionsDone: extra.filter((m) => m.done).length,
    extraMissionsTotal: extra.length,
    nextMissionText: extra.find((m) => !m.done)?.text ?? null,
    nextMissionHref: extra.find((m) => !m.done)?.id === "m_rev5" ? "/app/revisao" : "/app/treino",
  });
  const next = journey.next;

  return (
    <div className="hw">
      <PageHeader title="Como funciona" lead="Um hábito curto por dia, comentário que ensina e revisão na hora certa. Veja o caminho completo, do primeiro Plantão à sua evolução." />

      <nav className="hw-nav" aria-label="Neste guia">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>

      <Banner
        tone={next.allDone ? "done" : "today"}
        title={
          <>
            <span className="hw-kicker">Seu próximo passo</span>
            {next.title}
          </>
        }
        text={next.text}
        action={
          next.href && next.cta && next.href !== "/app/como-funciona" ? (
            <Link href={next.href} className="btn btn-primary">
              {next.cta}
            </Link>
          ) : undefined
        }
      />

      <section id="ciclo" className="hw-section" aria-labelledby="ciclo-h">
        <p className="eyebrow">Passo a passo</p>
        <h2 id="ciclo-h">Seu ciclo de estudo</h2>
        <p className="hw-lead">Comece pelo Plantão e siga a ordem. No dia seguinte, o ciclo recomeça: o que você errou já está esperando na Revisão.</p>

        <ol className="hw-cycle">
          {CYCLE.map((step, i) => (
            <li key={step.title} className="hw-cycle-item">
              <div className="hw-cycle-head">
                <span className="hw-num" aria-hidden>
                  {i + 1}
                </span>
                <ToolIcon name={step.icon} />
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <div className="hw-meta">
                <span className="hw-time">{step.time}</span>
                <Plan plan={step.plan} />
              </div>
              <Link href={step.href} className="hw-cycle-link">
                {step.cta} <Icon name="right" size={15} />
              </Link>
            </li>
          ))}
        </ol>

        <div className="hw-extras">
          <Link href="/app/simulados" className="hw-extra">
            <ToolIcon name="simulados" />
            <span>
              <strong>Simulados</strong>
              <small>Provas completas com relógio, para treinar o ritmo do dia da prova.</small>
            </span>
            <Plan plan="assinatura" />
          </Link>
          <Link href="/app/ligas" className="hw-extra">
            <ToolIcon name="ligas" />
            <span>
              <strong>Ligas</strong>
              <small>Dispute o XP da semana com colegas e suba de liga.</small>
            </span>
            <Plan plan="gratis" />
          </Link>
        </div>
      </section>

      <section id="questao" className="hw-section" aria-labelledby="questao-h">
        <p className="eyebrow">Na prática</p>
        <h2 id="questao-h">Dentro de uma questão</h2>
        <p className="hw-lead">Cada questão segue quatro momentos, e o mais valioso vem no final.</p>

        <ol className="hw-flow">
          {QUESTION_STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="hw-num" aria-hidden>
                {i + 1}
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>

        <h3 className="hw-sub">Depois de responder: quatro cartões para aprofundar</h3>
        <div className="hw-cards4">
          {STUDY_CARDS.map((card) => (
            <article key={card.title}>
              <span className="hw-ico">
                <Icon name={card.icon} size={22} />
              </span>
              <h4>{card.title}</h4>
              <p>{card.text}</p>
            </article>
          ))}
        </div>

        <h3 className="hw-sub">Ferramentas que ajudam no caminho</h3>
        <ul className="hw-tools">
          {TOOLS.map((tool) => (
            <li key={tool.title}>
              <span className="hw-ico is-small">
                <Icon name={tool.icon} size={18} />
              </span>
              <span>
                <strong>{tool.title}</strong>
                <small>{tool.text}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section id="pontos" className="hw-section" aria-labelledby="pontos-h">
        <p className="eyebrow">Progresso</p>
        <h2 id="pontos-h">Pontos e evolução</h2>
        <p className="hw-lead">Três números contam sua história. Cada um mede uma coisa diferente, então você pode estar bem em um e mal em outro.</p>

        <div className="hw-score">
          <article>
            <h3>Sequência</h3>
            <p className="hw-score-what">Mede seu hábito.</p>
            <p>Conta os dias seguidos em que você respondeu ao menos uma questão. A cada {SHIELD_EVERY} dias você ganha uma troca de plantão, que cobre uma falta. Você guarda até {MAX_SHIELDS}.</p>
          </article>

          <article>
            <h3>XP e nível</h3>
            <p className="hw-score-what">Mede seu esforço.</p>
            <dl className="hw-rows">
              <div><dt>Questão respondida</dt><dd>+{XP.attempt}</dd></div>
              <div><dt>Acerto</dt><dd>+{XP.correct}</dd></div>
              <div><dt>Revisão feita</dt><dd>+{XP.reviewDone}, e +{XP.reviewCorrect} se acertar</dd></div>
              <div><dt>Plantão completo</dt><dd>+{XP.dailyComplete}, e +{XP.dailyPerfect} se acertar tudo</dd></div>
              <div><dt>Simulado</dt><dd>+{XP.simuladoBase}, e +{XP.simuladoPerCorrect} por acerto</dd></div>
              <div><dt>Conquista</dt><dd>+{XP.achievement}</dd></div>
            </dl>
            <ul className="hw-chips" aria-label="Níveis">
              {LEVELS.map((level) => (
                <li key={level.name}>
                  {level.name}
                  <small>{level.min} XP</small>
                </li>
              ))}
            </ul>
          </article>

          <article>
            <h3>Rating e patente</h3>
            <p className="hw-score-what">Mede seu nível.</p>
            <p>Começa em {START_RATING}. Acertar questão difícil rende mais; errar questão fácil custa mais. As {PLACEMENT_GAMES} primeiras questões calibram o número, e errar nelas custa pouco.</p>
            <ul className="hw-chips" aria-label="Patentes">
              {TIERS.map((tier) => (
                <li key={tier.name} style={{ borderColor: tier.from }}>
                  <i aria-hidden style={{ background: `linear-gradient(135deg, ${tier.from}, ${tier.to})` }} />
                  {tier.name}
                  <small>{tier.min}+</small>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section id="planos" className="hw-section" aria-labelledby="planos-h">
        <p className="eyebrow">Planos</p>
        <h2 id="planos-h">O que é grátis e o que é assinatura</h2>
        <div className="hw-plans">
          <article>
            <Plan plan="gratis" />
            <h3>Para criar o hábito</h3>
            <ul>
              <li>Plantão do Dia, todo dia, com o comentário completo</li>
              <li>Sequência, XP, nível e rating</li>
              <li>Ligas, conquistas e o mascote</li>
              <li>Evolução com sua faixa de acerto por área</li>
            </ul>
          </article>
          <article className="is-pro">
            <Plan plan="assinatura" />
            <h3>
              Para estudar de verdade <small>R$ 29 por mês</small>
            </h3>
            <ul>
              <li>Revisão que traz de volta o que você errou, na hora certa</li>
              <li>Treino por área, no tamanho que você escolher</li>
              <li>Simulados completos com relógio</li>
              <li>Termômetro de Proficiência e missões extras</li>
            </ul>
            {premium ? (
              <p className="hw-active">
                <Icon name="check" size={16} /> Sua assinatura está ativa.
              </p>
            ) : (
              <Link href="/assinar" className="btn btn-primary">
                Ver assinatura
              </Link>
            )}
          </article>
        </div>
      </section>

      <section id="duvidas" className="hw-section" aria-labelledby="duvidas-h">
        <p className="eyebrow">Ajuda rápida</p>
        <h2 id="duvidas-h">Dúvidas frequentes</h2>
        <div className="hw-faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="glossario" className="hw-section" aria-labelledby="glossario-h">
        <p className="eyebrow">Consulta</p>
        <h2 id="glossario-h">Glossário</h2>
        <dl className="hw-glossary">
          {GLOSSARY.map((item) => (
            <div key={item.id} id={item.id}>
              <dt>{item.term}</dt>
              <dd>{item.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p>
        <Link href="/app" className="btn btn-primary">
          Voltar para Hoje
        </Link>
      </p>
    </div>
  );
}
