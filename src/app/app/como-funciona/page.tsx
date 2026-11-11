import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { PLACEMENT_GAMES, TIERS } from "@/lib/game/rating";
import { MAX_SHIELDS, SHIELD_EVERY } from "@/lib/game/streak";
import { LEVELS, XP } from "@/lib/game/xp";

export const metadata: Metadata = { title: "Como funciona" };

const JOURNEY = [
  ["Faça o Plantão do Dia", "São 10 questões iguais para todo mundo, todo dia. Ele é sempre grátis e mantém sua sequência."],
  ["Leia a explicação de cada questão", "Depois de responder, você vê o raciocínio em camadas. O que você erra volta na Revisão, na hora certa para não esquecer."],
  ["Revise o que voltou", "A Revisão repete o que você errou ou chutou. Quanto mais você acerta, mais espaçado ele volta."],
  ["Treine por área", "Escolha a área e o tamanho da rodada. Treinar completa as missões do dia."],
  ["Acompanhe sua evolução", "Veja seu rating, sua faixa de acerto por área e por que você erra."],
];

export default function HowItWorksPage() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader title="Como funciona" lead="Cada dia tem poucos passos. Faça um de cada vez e o resto acontece sozinho." />

      <section aria-labelledby="jornada-h">
        <h2 id="jornada-h" style={{ fontSize: 20, marginBottom: 10 }}>
          Seu dia no EnaQuest
        </h2>
        <ol className="journey">
          {JOURNEY.map(([title, text], i) => (
            <li key={title} className="step">
              <span className="step-num" aria-hidden>
                {i + 1}
              </span>
              <span>
                <h3>{title}</h3>
                <p>{text}</p>
              </span>
              <span />
            </li>
          ))}
        </ol>
      </section>

      <section className="card" aria-labelledby="glossario">
        <h2 id="glossario" style={{ fontSize: 20, marginBottom: 10 }}>
          O que cada palavra significa
        </h2>
        <dl style={{ display: "grid", gap: 14 }}>
          <div id="plantao">
            <dt>
              <strong>Plantão</strong>
            </dt>
            <dd className="muted">As 10 questões do dia. Todo mundo recebe as mesmas, então dá para comparar seu resultado com a turma.</dd>
          </div>
          <div id="sequencia">
            <dt>
              <strong>Sequência</strong>
            </dt>
            <dd className="muted">Quantos dias seguidos você respondeu pelo menos uma questão. Ela zera se você passar um dia sem estudar.</dd>
          </div>
          <div id="troca">
            <dt>
              <strong>Troca de plantão</strong>
            </dt>
            <dd className="muted">
              Um colega cobre um dia em que você não estudou, e a sequência continua. Você ganha uma a cada {SHIELD_EVERY} dias seguidos e guarda até {MAX_SHIELDS}.
            </dd>
          </div>
          <div id="xp">
            <dt>
              <strong>XP e nível</strong>
            </dt>
            <dd className="muted">
              XP mede seu esforço: {XP.attempt} por questão respondida, mais {XP.correct} se acertar, {XP.reviewDone} por revisão e {XP.errorDiagnosed} por marcar o motivo de um erro. Os níveis são{" "}
              {LEVELS.map((l) => l.name).join(", ")}.
            </dd>
          </div>
          <div id="rating">
            <dt>
              <strong>Rating e patente</strong>
            </dt>
            <dd className="muted">
              Rating mede seu nível: acertar questão difícil rende mais, errar questão fácil custa mais. As {PLACEMENT_GAMES} primeiras questões calibram o número, e errar nelas custa pouco. A patente é a faixa do seu rating:{" "}
              {TIERS.map((t) => t.name).join(", ")}.
            </dd>
          </div>
          <div id="liga">
            <dt>
              <strong>Liga</strong>
            </dt>
            <dd className="muted">Um grupo de estudantes que disputa o XP da semana, de segunda a domingo. Quem fica no topo sobe de liga; quem fica no fim desce.</dd>
          </div>
          <div id="revisao">
            <dt>
              <strong>Revisão</strong>
            </dt>
            <dd className="muted">Questões que você errou ou acertou sem certeza, de volta na hora certa. É o que mais ajuda a fixar.</dd>
          </div>
          <div id="mascote">
            <dt>
              <strong>Seu companheiro de jornada</strong>
            </dt>
            <dd className="muted">
              Escolha um dos oito mascotes para acompanhar seus estudos. Cada personagem tem seu próprio nome e conversa com você durante as questões, revisões e simulados. Você pode trocar de companheiro quando quiser.
            </dd>
          </div>
          <div id="confianca">
            <dt>
              <strong>Confiança</strong>
            </dt>
            <dd className="muted">Antes de responder, você diz se tem certeza, dúvida ou vai chutar. Isso é opcional e ajuda a escolher o que volta na Revisão e a mostrar se sua confiança é confiável.</dd>
          </div>
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
