"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { answerAction, todayMissionsAction } from "@/app/actions";
import type { PublicQuestion } from "@/lib/server/questions";
import type { AnswerResult } from "@/lib/server/answers";
import { ACHIEVEMENTS, type Mission } from "@/lib/game/progress";
import { XP } from "@/lib/game/xp";
import { CONFIDENCE_LABEL } from "@/lib/ui/labels";
import { markSeen } from "@/lib/ui/coach";
import { playCue, writePrefs, type Cue } from "@/lib/ui/feedback";
import type { Confidence } from "@/lib/study/srs";
import { Celebration, type CelebrationItem } from "./Celebration";
import { Coach } from "./Coach";
import { ComboMeter, COMBO_MILESTONES } from "./ComboMeter";
import { Confetti } from "./Confetti";
import { useFeedbackPrefs } from "./FeedbackSettings";
import { MascotStation } from "./plantao/MascotStation";
import { useMascotState } from "./plantao/useMascotState";
import { ExamTables, OptionsList, QuestionHeader } from "./QuestionView";
import { RevealPanel } from "./RevealPanel";
import { PROGRESS_EVENT, type ProgressEventDetail } from "./TopStats";
import { ToastStack, useToasts } from "./Toasts";
import { ScoreRing, scoreMessage } from "./ui";

type Area = { id: string; name: string; color: string };

export function QuestionRunner({
  questions,
  mode,
  context,
  areas,
  alreadyAnswered = {},
  onDone,
  doneHref = "/app",
  doneLabel = "Voltar para Hoje",
}: {
  questions: PublicQuestion[];
  mode: "daily" | "training" | "review";
  context: string;
  areas: Area[];
  alreadyAnswered?: Record<string, { selected: number; correct: boolean }>;
  onDone?: () => void;
  doneHref?: string;
  doneLabel?: string;
}) {
  const firstOpen = Math.max(0, questions.findIndex((q) => !alreadyAnswered[q.id]));
  const [index, setIndex] = useState(firstOpen);
  const [picked, setPicked] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [struck, setStruck] = useState<number[]>([]);
  const [results, setResults] = useState<Record<string, AnswerResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [needsPremium, setNeedsPremium] = useState(false);
  const [finished, setFinished] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [combo, setCombo] = useState({ value: 0, broken: 0 });
  const [queue, setQueue] = useState<CelebrationItem[]>([]);
  const [showing, setShowing] = useState<CelebrationItem[] | null>(null);
  const [missions, setMissions] = useState<Mission[] | null>(null);
  const [pending, start] = useTransition();
  const startedAt = useRef<number>(0);
  const firstRender = useRef(true);
  const articleRef = useRef<HTMLElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const { toasts, push } = useToasts();
  const prefs = useFeedbackPrefs();

  const question = questions[index];
  const result = question ? results[question.id] : undefined;
  const area = areas.find((a) => a.id === question?.areaId);
  const roundOver = !question || finished;
  const answeredInRound = Object.keys(results).length;
  const mascot = useMascotState({
    questionId: question?.id ?? "fim",
    areaId: question?.areaId,
    scenario: question?.scenario,
    clinicalHint: question?.clinicalHint,
  });

  // Os handlers da tela avisam o mascote; a lógica de resposta continua a mesma.
  const pickOption = (position: number) => {
    setPicked(position);
    mascot.onSelectOption(position);
  };
  const strikeOption = (position: number) => {
    const nowStruck = !struck.includes(position);
    setStruck((s) => (s.includes(position) ? s.filter((x) => x !== position) : [...s, position]));
    mascot.onEliminateOption(position, nowStruck);
  };
  const chooseConfidence = (level: Confidence) => {
    setConfidence(level);
    mascot.onSelectConfidence(level);
  };

  useEffect(() => {
    startedAt.current = Date.now();
    window.scrollTo({ top: 0 });
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Nova questão: leitor de tela e teclado começam do enunciado.
    articleRef.current?.focus({ preventScroll: true });
  }, [index]);

  // Depois de responder, o foco vai para o resultado, que é anunciado.
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  // No fim da rodada, busca como ficaram as missões do dia.
  useEffect(() => {
    if (!roundOver || answeredInRound === 0) return;
    let alive = true;
    todayMissionsAction().then((response) => {
      if (alive && response.ok) setMissions(response.data);
    });
    return () => {
      alive = false;
    };
  }, [roundOver, answeredInRound]);

  /** Reação a uma resposta: som, avisos, topo atualizado e fila de comemorações. */
  const celebrateResult = (data: AnswerResult) => {
    const cues: Cue[] = [data.correct ? "correct" : "wrong"];
    if (data.correct && COMBO_MILESTONES.includes(data.combo)) cues.push("combo");
    if (data.newAchievements.length) cues.push("achievement");
    if (data.tierUp || data.levelUp) cues.push("levelup");
    playCue(cues[cues.length - 1]);

    for (const id of data.newAchievements) {
      const achievement = ACHIEVEMENTS.find((a) => a.id === id);
      push({ tone: "gold", title: `Conquista: ${achievement?.name ?? id}`, text: `${achievement?.description ?? ""} +${XP.achievement} XP` });
    }
    if (data.correct && data.combo === 3 && markSeen("combo")) {
      push({ tone: "info", title: "Combo de 3 acertos", text: "Acertos seguidos enchem a barra até o próximo marco." });
    }
    if (data.usedShield) push({ tone: "info", title: "Troca de plantão usada", text: "Um colega cobriu seu dia. A sequência continua." });
    if (data.earnedShield) push({ tone: "ok", title: "Você ganhou uma troca de plantão", text: "Ela cobre um dia em que você não puder estudar." });

    const items: CelebrationItem[] = [];
    if (data.tierUp) items.push({ kind: "tier", name: data.tierName, rating: data.ratingAfter });
    if (data.levelUp) items.push({ kind: "level", name: data.levelUp });
    if (items.length) setQueue((current) => [...current, ...items]);
    if (data.dailyFinished) setCelebrate(true);

    window.dispatchEvent(
      new CustomEvent<ProgressEventDetail>(PROGRESS_EVENT, { detail: { xpTotal: data.xpTotal, streak: data.streak, shields: data.shields } }),
    );
  };

  const submit = () => {
    if (picked === null || !question) return;
    setError(null);
    start(async () => {
      const response = await answerAction({
        questionId: question.id,
        mode,
        context,
        selected: picked,
        confidence,
        ms: Math.min(Date.now() - startedAt.current, 3_600_000),
      });
      if (!response.ok) {
        if (response.code === "premium_required") setNeedsPremium(true);
        setError(response.message);
        return;
      }
      setResults((current) => ({ ...current, [question.id]: response.data }));
      mascot.onAnswer({ correct: response.data.correct, xp: response.data.xpGained, combo: response.data.combo });
      setCombo({ value: response.data.combo, broken: response.data.correct ? 0 : response.data.previousCombo });
      celebrateResult(response.data);
    });
  };

  const advance = () => {
    setPicked(null);
    setConfidence(null);
    setStruck([]);
    setCelebrate(false);
    const nextIndex = questions.findIndex((q, i) => i > index && !alreadyAnswered[q.id] && !results[q.id]);
    if (nextIndex === -1) {
      setFinished(true);
      onDone?.();
    } else {
      setIndex(nextIndex);
    }
  };

  // Subida de patente ou de nível aparece ao continuar, depois de ler a explicação.
  const next = () => {
    if (queue.length) {
      setShowing(queue);
      setQueue([]);
      return;
    }
    advance();
  };

  const closeCelebration = () => {
    setShowing(null);
    advance();
  };

  // Atalhos: A a D escolhem, Enter confirma ou avança.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.tagName === "SELECT") return;
      if (!question || showing) return;
      // Ctrl+A, Ctrl+C, Cmd+D e afins são do navegador, não escolhas de alternativa.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (!result) {
        const position = "abcd".indexOf(event.key.toLowerCase());
        if (position >= 0 && position < question.options.length) pickOption(position);
        if (event.key === "Enter" && picked !== null && !pending) submit();
      } else if (event.key === "Enter" && target.tagName !== "BUTTON" && target.tagName !== "A") {
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (needsPremium) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 22 }}>Isso faz parte da assinatura</h2>
        <p className="muted" style={{ margin: "8px 0 14px" }}>
          O Plantão do Dia é sempre grátis. Treino, revisão e simulados custam R$ 29 por mês.
        </p>
        <Link href="/assinar" className="btn btn-primary">
          Ver assinatura
        </Link>
      </div>
    );
  }

  if (roundOver) {
    const list = Object.values(results);
    const hits = list.filter((r) => r.correct).length;
    const earned = list.flatMap((r) => r.newAchievements);
    const bonusXp = list.reduce((sum, r) => sum + r.bonusXp, 0);
    const answerXp = list.reduce((sum, r) => sum + r.xpGained, 0) - bonusXp;
    const achievementXp = earned.length * XP.achievement;
    const totalXp = answerXp + bonusXp + achievementXp;
    const ratingSum = list.reduce((sum, r) => sum + r.ratingDelta, 0);
    const bestCombo = list.reduce((max, r) => Math.max(max, r.combo), 0);
    const last = list[list.length - 1];

    return (
      <div className="card" style={{ textAlign: "center" }}>
        {showing && <Celebration items={showing} onClose={() => setShowing(null)} />}
        {(celebrate || hits === list.length) && list.length >= 3 && <Confetti />}
        <p className="eyebrow">Rodada concluída</p>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, flexWrap: "wrap", margin: "10px 0 8px" }}>
          <ScoreRing correct={hits} total={list.length} />
        </div>
        <h2 style={{ fontSize: 24 }}>{scoreMessage(hits, list.length).title}</h2>
        <p className="muted">
          Você ganhou <strong>{totalXp} XP</strong> nesta rodada.
        </p>

        <dl className="round-stats">
          <div>
            <dt>XP das respostas</dt>
            <dd>+{answerXp}</dd>
          </div>
          {bonusXp > 0 && (
            <div>
              <dt>Bônus do plantão</dt>
              <dd>+{bonusXp}</dd>
            </div>
          )}
          {achievementXp > 0 && (
            <div>
              <dt>Conquistas</dt>
              <dd>+{achievementXp}</dd>
            </div>
          )}
          <div>
            <dt>Rating</dt>
            <dd>
              {ratingSum > 0 ? "+" : ""}
              {ratingSum}
            </dd>
          </div>
          <div>
            <dt>Maior combo</dt>
            <dd>{bestCombo}</dd>
          </div>
          {last && (
            <div>
              <dt>Sequência</dt>
              <dd>{last.streak} dias</dd>
            </div>
          )}
        </dl>

        {earned.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
            {earned.map((id) => (
              <span key={id} className="pill" style={{ background: "var(--pearl-soft)", color: "var(--gold)" }}>
                Conquista: {ACHIEVEMENTS.find((a) => a.id === id)?.name}
              </span>
            ))}
          </div>
        )}

        {missions && (
          <div className="card-2" style={{ marginTop: 14, textAlign: "left" }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              Missões de hoje
            </p>
            <ul style={{ display: "grid", gap: 8 }}>
              {missions.map((mission) => (
                <li key={mission.id} style={{ fontSize: 14.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={mission.done ? { color: "var(--ok)", fontWeight: 600 } : undefined}>
                      {mission.done ? "✓ " : ""}
                      {mission.text}
                    </span>
                    <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {mission.current}/{mission.goal}
                    </span>
                  </div>
                  <div className="bar" style={{ height: 6, marginTop: 4 }} aria-hidden>
                    <i style={{ width: `${(mission.current / mission.goal) * 100}%`, background: mission.done ? "var(--ok)" : undefined }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href={doneHref} className="btn btn-primary">
            {doneLabel}
          </Link>
          <Link href="/app/evolucao" className="btn btn-ghost">
            Ver evolução
          </Link>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(alreadyAnswered).length + Object.keys(results).length;
  // Depois de responder, as alternativas corrigidas sobem para junto do enunciado e a coluna direita fica com o comentário.
  const options = (
    <OptionsList
      question={question}
      picked={result ? result.selected : picked}
      onPick={pickOption}
      struck={struck}
      onStrike={strikeOption}
      locked={Boolean(result) || pending}
      correctIndex={result?.reveal.correctIndex ?? null}
    />
  );

  return (
    <div className="qgrid-wrap">
      {celebrate && <Confetti />}
      {showing && <Celebration items={showing} onClose={closeCelebration} />}
      <ToastStack toasts={toasts} />
      <div className="round-head">
        <span className="round-count">
          Questão {index + 1} de {questions.length}
        </span>
        <div className="bar level" style={{ flex: 1 }} role="progressbar" aria-valuenow={answeredCount} aria-valuemin={0} aria-valuemax={questions.length} aria-label="Progresso da rodada">
          <i style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-pressed={prefs.sound}
          title={prefs.sound ? "Desligar sons" : "Ligar sons"}
          onClick={() => writePrefs({ ...prefs, sound: !prefs.sound })}
        >
          {prefs.sound ? "Som ligado" : "Som desligado"}
        </button>
      </div>
      <ComboMeter combo={combo.value} broken={combo.broken} />
      {!result && (
        <Coach id="primeira-questao" title="Como responder">
          Escolha uma alternativa, diga o quanto você tem de certeza (é opcional) e toque em Responder. A explicação aparece logo depois.
        </Coach>
      )}

      <article className={`card qgrid ${result ? "is-answered" : ""}`} ref={articleRef} tabIndex={-1} aria-label={`Questão ${index + 1} de ${questions.length}`}>
        <div className="qleft">
          <div>
          <QuestionHeader question={question} areaName={area?.name} areaColor={area?.color} />
          <p className="stem">{question.stem}</p>
          <ExamTables exams={question.exams} />
          {result && options}
          </div>
          <div className="mascot-station-dock">
            <MascotStation view={mascot} onRequestHint={mascot.onRequestHint} />
          </div>
        </div>

        <div className="qright">
          {!result && options}

          {!result && (
            <>
              <div style={{ marginTop: 8 }} role="group" aria-labelledby="confianca-q">
                <div id="confianca-q" className="eyebrow">
                  Qual a sua confiança?
                </div>
                <p className="dim hint">Opcional. Ajuda a decidir o que volta na sua Revisão.</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(Object.keys(CONFIDENCE_LABEL) as Confidence[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-pressed={confidence === level}
                      style={confidence === level ? { borderColor: "var(--accent)", background: "var(--tip-soft)" } : undefined}
                      onClick={() => chooseConfidence(level)}
                    >
                      {CONFIDENCE_LABEL[level]}
                    </button>
                  ))}
                </div>
              </div>
              <p className="dim kbd-help">Atalhos: as teclas A a D escolhem a alternativa e Enter confirma.</p>
              <div className="sticky-action">
                {picked === null && <p className="dim hint">Escolha uma alternativa para responder.</p>}
                <button type="button" className="btn btn-primary" style={{ width: "100%" }} disabled={picked === null || pending} onClick={submit}>
                  {pending ? "Corrigindo…" : "Responder"}
                </button>
              </div>
              {error && (
                <div className="alert alert-error" style={{ marginTop: 10 }} role="alert">
                  {error}
                </div>
              )}
              <div className="mascot-station-dock-mobile">
                <MascotStation view={mascot} onRequestHint={mascot.onRequestHint} variant="compact" />
              </div>
            </>
          )}

          {result && (
            <>
              <div
                ref={resultRef}
                tabIndex={-1}
                className="xp-float result-box"
                role="status"
                style={{ background: result.correct ? "var(--ok-soft)" : "var(--bad-soft)" }}
              >
                <strong style={{ color: result.correct ? "var(--ok)" : "var(--bad)" }}>{result.correct ? "Acertou!" : "Não foi dessa vez"}</strong>
                {result.xpGained > 0 && <span className="pill">+{result.xpGained} XP</span>}
                {result.ratingDelta !== 0 && (
                  <span className="pill">
                    {result.ratingDelta > 0 ? "+" : ""}
                    {result.ratingDelta} no rating
                  </span>
                )}
                {result.combo >= 3 && <span className="pill">{result.combo} seguidas</span>}
                {result.placementLeft > 0 && <span className="pill">Nivelamento: faltam {result.placementLeft}</span>}
                {result.tierUp && <span className="pill">Nova patente: {result.tierName}</span>}
                {result.levelUp && <span className="pill">Novo nível: {result.levelUp}</span>}
                {result.dailyFinished && (
                  <span className="pill">
                    Plantão concluído: {result.dailyFinished.correct}/{result.dailyFinished.total}
                  </span>
                )}
              </div>

              <div className="mascot-station-dock-mobile">
                <MascotStation view={mascot} onRequestHint={mascot.onRequestHint} variant="compact" />
              </div>

              <RevealPanel
                reveal={result.reveal}
                options={question.options}
                questionId={question.id}
                verification={question.verification}
                selected={result.selected}
                answerId={result.answerId}
              />

              <div className="sticky-action">
                <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={next}>
                  Continuar
                </button>
              </div>
            </>
          )}
        </div>
      </article>
    </div>
  );
}
