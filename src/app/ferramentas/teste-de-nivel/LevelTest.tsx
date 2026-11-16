"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ExamTables, OptionsList, QuestionHeader } from "@/components/QuestionView";
import type { PublicQuestion } from "@/lib/server/questions";
import { checkLevelAnswerAction, startLevelTestAction } from "../actions";
import s from "../tools.module.css";

type Area = { id: string; name: string; color: string };
type Check = { correct: boolean; correctIndex: number; quick: string };

/** Faixas só para orientar o estudo: com 10 questões, o retrato é rápido, não uma nota. */
function band(hits: number, total: number) {
  const pct = total ? hits / total : 0;
  if (pct >= 0.8) return { title: "Ritmo de prova", text: "Você já acerta a maior parte. O ganho agora vem de revisar os detalhes e treinar com tempo." };
  if (pct >= 0.5) return { title: "No caminho", text: "A base está lá. Treinar por área e revisar os erros na hora certa é o que mais sobe o seu acerto." };
  return { title: "Base em construção", text: "Comece pelas áreas de maior peso na prova e faça um pouco todo dia. Constância rende mais que maratona." };
}

export function LevelTest({ areas, signedIn }: { areas: Area[]; signedIn: boolean }) {
  const [test, setTest] = useState<{ id: string; questions: PublicQuestion[] } | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);

  const begin = () =>
    start(async () => {
      setError(null);
      const result = await startLevelTestAction();
      if (!result.ok) return setError(result.message);
      setTest(result.data);
      setIndex(0);
      setPicked(null);
      setChecks({});
    });

  if (!test) {
    return (
      <div className={s.panel}>
        <ol className={s.steps}>
          <li><strong>10 questões</strong> no estilo do ENAMED e do ENARE, sorteadas no peso de cada área da prova.</li>
          <li><strong>Correção na hora</strong>, com o motivo da resposta certa em poucas linhas.</li>
          <li><strong>Seu retrato por área</strong> no fim, para saber por onde começar.</li>
        </ol>
        <button type="button" className={s.primary} onClick={begin} disabled={pending}>
          {pending ? "Preparando..." : "Começar o teste"} <span aria-hidden="true">→</span>
        </button>
        <p className={s.note}>Sem cadastro. Leva cerca de 15 minutos e suas respostas não ficam gravadas.</p>
        {error && <p className={s.error} role="alert">{error}</p>}
      </div>
    );
  }

  const total = test.questions.length;
  const finished = Object.keys(checks).length === total && index >= total;

  if (finished) {
    const hits = test.questions.filter((q) => checks[q.id]?.correct).length;
    const result = band(hits, total);
    const byArea = areas
      .map((area) => {
        const qs = test.questions.filter((q) => q.areaId === area.id);
        return { ...area, n: qs.length, hits: qs.filter((q) => checks[q.id]?.correct).length };
      })
      .filter((a) => a.n > 0);
    return (
      <div className={s.panel} ref={top}>
        <p className={s.kicker}>Seu resultado</p>
        <p className={s.score}>
          {hits}<small>/{total}</small>
        </p>
        <h2 className={s.bandTitle}>{result.title}</h2>
        <p className={s.lead}>{result.text}</p>
        <ul className={s.areaList} aria-label="Acertos por área">
          {byArea.map((area) => (
            <li key={area.id}>
              <span><i style={{ background: area.color }} aria-hidden="true" /> {area.name}</span>
              <strong>{area.hits} de {area.n}</strong>
            </li>
          ))}
        </ul>
        <p className={s.note}>Com 10 questões, isto é um retrato rápido, não uma previsão de nota.</p>
        <div className={s.actions}>
          <Link className={s.primary} href={signedIn ? "/app" : "/cadastrar"}>
            {signedIn ? "Abrir meu Plantão do Dia" : "Criar conta grátis e fazer o Plantão do Dia"} <span aria-hidden="true">→</span>
          </Link>
          <Link className={s.secondary} href="/ferramentas/plano-de-estudo">Montar meu plano de estudo</Link>
          <button type="button" className={s.secondary} onClick={begin} disabled={pending}>Fazer outro teste</button>
        </div>
      </div>
    );
  }

  const question = test.questions[index];
  const check = checks[question.id];
  const area = areas.find((a) => a.id === question.areaId);

  const answer = () =>
    start(async () => {
      if (picked === null) return;
      setError(null);
      const result = await checkLevelAnswerAction(question.id, picked);
      if (!result.ok) return setError(result.message);
      setChecks((all) => ({ ...all, [question.id]: result.data }));
    });

  const next = () => {
    setIndex((i) => i + 1);
    setPicked(null);
    setError(null);
    top.current?.scrollIntoView({ block: "start" });
  };

  return (
    <div className={s.panel} ref={top}>
      <div className={s.progressHead}>
        <span>Questão {index + 1} de {total}</span>
        <span>{Object.values(checks).filter((c) => c.correct).length} acertos</span>
      </div>
      <div className={s.progress} aria-hidden="true">
        {test.questions.map((q, i) => (
          <i key={q.id} className={checks[q.id] ? (checks[q.id].correct ? s.hit : s.miss) : i === index ? s.current : undefined} />
        ))}
      </div>

      <article className={s.question} aria-label={`Questão ${index + 1}`}>
        <QuestionHeader question={question} areaName={area?.name} areaColor={area?.color} />
        <p className="stem">{question.stem}</p>
        <ExamTables exams={question.exams} images={question.images} />
        <OptionsList
          question={question}
          picked={picked}
          onPick={check ? undefined : setPicked}
          locked={Boolean(check) || pending}
          correctIndex={check ? check.correctIndex : null}
        />
      </article>

      {check && (
        <div className={check.correct ? s.feedbackOk : s.feedbackBad} role="status">
          <strong>{check.correct ? "Você acertou." : "Não foi dessa vez."}</strong> {check.quick}
        </div>
      )}
      {error && <p className={s.error} role="alert">{error}</p>}

      <div className={s.actions}>
        {check ? (
          <button type="button" className={s.primary} onClick={next}>
            {index + 1 === total ? "Ver meu resultado" : "Próxima questão"} <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button type="button" className={s.primary} onClick={answer} disabled={picked === null || pending}>
            {pending ? "Corrigindo..." : "Responder"}
          </button>
        )}
      </div>
    </div>
  );
}
