"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { Reveal } from "@/lib/server/questions";
import type { Summary, Theory } from "@/lib/study/content";
import { Icon, type IconName } from "./StudyIcons";

type CardId = "teoria" | "dica" | "raciocinio" | "resumo";

const CARDS: { id: CardId; title: string; lead: string; icon: IconName; tone: string }[] = [
  { id: "teoria", title: "Revisão do tema", lead: "A teoria por trás", icon: "book", tone: "sky" },
  { id: "dica", title: "Dica de ouro", lead: "Macete e armadilha", icon: "bulb", tone: "gold" },
  { id: "raciocinio", title: "Como pensar", lead: "Passo a passo", icon: "chat", tone: "violet" },
  { id: "resumo", title: "Resumo", lead: "Para revisar rápido", icon: "pill", tone: "ok" },
];

export function TheoryView({ theory }: { theory: Theory }) {
  return (
    <>
      <h3 className="study-h">{theory.title}</h3>
      <p>{theory.intro}</p>
      {theory.sections.map((section) => (
        <section key={section.heading}>
          <h4 className="study-sub">{section.heading}</h4>
          {section.body && <p>{section.body}</p>}
          {section.items && (
            <ul className="study-list">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {theory.alert && (
        <p className="study-alert">
          <strong>Atenção:</strong> {theory.alert}
        </p>
      )}
    </>
  );
}

export function SummaryView({ summary }: { summary: Summary }) {
  return (
    <>
      <h3 className="study-h">{summary.title}</h3>
      <ul className="study-list">
        {summary.points.map((point) => (
          <li key={point.label}>
            <strong>{point.label}:</strong> {point.text}
            {point.sub && (
              <ul className="study-list">
                {point.sub.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Aprofundamento depois de responder: quatro cartões com teoria, macete, raciocínio e resumo.
 * Cartões sem conteúdo (questões antigas) não aparecem.
 */
export function StudyPanel({ reveal, wrong }: { reveal: Reveal; wrong: boolean }) {
  const cards = CARDS.filter((card) => (card.id === "teoria" ? reveal.theory : card.id === "resumo" ? reveal.summary : true));
  const [active, setActive] = useState<CardId | null>(wrong ? "raciocinio" : "dica");
  const base = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = cards.find((c) => c.id === active);

  const onKey = (event: KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + cards.length) % cards.length;
    setActive(cards[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <section className="study" aria-labelledby={`${base}-title`}>
      <div className="study-head">
        <h3 id={`${base}-title`} className="study-title">
          <Icon name="book" /> Aprofunde seu conhecimento
        </h3>
        <span className="dim">{wrong ? "Escolhido para o seu erro" : "Para fixar o acerto"}</span>
      </div>

      <div className="study-cards" role="tablist" aria-label="Materiais de estudo">
        {cards.map((card, index) => (
          <button
            key={card.id}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${card.id}`}
            aria-selected={active === card.id}
            aria-controls={`${base}-panel`}
            tabIndex={active === card.id || (!active && index === 0) ? 0 : -1}
            className={`study-card tone-${card.tone}`}
            onClick={() => setActive(card.id)}
            onKeyDown={(e) => onKey(e, index)}
          >
            <span className="study-card-icon">
              <Icon name={card.icon} size={22} />
            </span>
            <span className="study-card-text">
              <strong>{card.title}</strong>
              <span>{card.lead}</span>
            </span>
            <span className="study-card-go" aria-hidden="true">
              <Icon name="chevron" size={16} />
            </span>
          </button>
        ))}
      </div>

      {current && (
        <div className={`study-body tone-${current.tone}`} role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${current.id}`}>
          <button type="button" className="study-close" aria-label="Fechar material" onClick={() => setActive(null)}>
            <Icon name="x" size={16} />
          </button>
          <div className="study-badge">
            <span className="study-badge-icon">
              <Icon name={current.icon} size={30} />
            </span>
            <span className="eyebrow">{current.title}</span>
          </div>

          {current.id === "teoria" && reveal.theory && <TheoryView theory={reveal.theory} />}
          {current.id === "resumo" && reveal.summary && <SummaryView summary={reveal.summary} />}
          {current.id === "dica" && (
            <>
              <h4 className="study-sub">Macete de prova</h4>
              <p>{reveal.tip}</p>
              <h4 className="study-sub">Armadilha clássica</h4>
              <p>{reveal.pearl}</p>
            </>
          )}
          {current.id === "raciocinio" && (
            <>
              <h4 className="study-sub">Raciocínio clínico</h4>
              <p>{reveal.reasoning}</p>
              <h4 className="study-sub">O que a prova quer de você</h4>
              <p>{reveal.competencyNote}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
