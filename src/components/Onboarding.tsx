"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { completeOnboardingAction } from "@/app/actions";
import { DAILY_MINUTES_OPTIONS } from "@/lib/study/day-plan";
import { examDateFromMonth, minutesLabel, monthAvailable, monthOf, MONTHS, questionsFor } from "@/lib/study/onboarding";
import { MyMascot } from "./MyMascot";

type Exam = "enamed" | "enare";
type School = { id: string; name: string; uf: string | null };

export type OnboardingInitial = {
  targetExam: Exam | null;
  minutes: number | null;
  examDate: string | null;
  nickname: string;
  schoolId: string | null;
  showSchool: boolean;
};

const STEPS = [
  { label: "Seu objetivo" },
  { label: "Seu ritmo" },
  { label: "Seu perfil" },
  { label: "Prazo" },
] as const;

const EXAMS: { value: Exam; title: string; text: string; icon: string }[] = [
  {
    value: "enamed",
    title: "ENAMED",
    text: "Avaliação nacional do Inep para quem está terminando Medicina.",
    icon: "M9 4h6v3H9V4ZM7 6H5v15h14V6h-2M9 13l2 2 4-4",
  },
  {
    value: "enare",
    title: "ENARE",
    text: "Seleção nacional para entrar na residência médica.",
    icon: "M4 21V8l8-5 8 5v13M9 21v-6h6v6M12 7v4m-2-2h4",
  },
];

const NICKNAME = /^[\p{L}\p{N}_.-]{3,24}$/u;

function Icon({ d }: { d: string }) {
  return (
    <span className="onb-icon" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}

function Check() {
  return (
    <svg className="onb-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

/** Primeiro acesso em quatro passos: prova, tempo por dia, perfil e mês da prova. */
export function Onboarding({ firstName, initial, schools, today }: { firstName: string | null; initial: OnboardingInitial; schools: School[]; today: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [targetExam, setTargetExam] = useState<Exam | null>(initial.targetExam);
  const [minutes, setMinutes] = useState<number | null>(initial.minutes);
  const [nickname, setNickname] = useState(initial.nickname);
  const [schoolId, setSchoolId] = useState<string | null>(initial.schoolId);
  const [showSchool, setShowSchool] = useState(initial.showSchool);
  const [query, setQuery] = useState("");
  const thisYear = Number(today.slice(0, 4));
  const saved = monthOf(initial.examDate);
  const [year, setYear] = useState(saved?.year ?? thisYear + 1);
  const [month, setMonth] = useState<number | null>(saved?.month ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  const school = schools.find((s) => s.id === schoolId) ?? null;
  const matches = useMemo(() => {
    const words = query
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const plain = (s: School) => `${s.name} ${s.uf ?? ""}`.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    return (words.length ? schools.filter((s) => words.every((w) => plain(s).includes(w))) : schools).slice(0, 40);
  }, [query, schools]);

  const examDate = month ? examDateFromMonth(year, month, today) : null;
  const nicknameOk = NICKNAME.test(nickname.trim());
  const canContinue = [targetExam !== null, minutes !== null, nicknameOk, month === null || examDate !== null][step];
  const last = step === STEPS.length - 1;

  const finish = () =>
    start(async () => {
      setError(null);
      const result = await completeOnboardingAction({
        targetExam: targetExam!,
        minutes: minutes!,
        examDate,
        nickname: nickname.trim(),
        schoolId,
        showSchool,
      });
      if (!result.ok) {
        setError(result.message);
        if (result.message.includes("apelido")) setStep(2);
        return;
      }
      router.push("/app");
      router.refresh();
    });

  const next = () => (last ? finish() : setStep(step + 1));

  return (
    <div className="onb">
      <header className="onb-top">
        <span className="onb-brand">
          <span className="logo" aria-hidden>
            E
          </span>
          EnaQuest
        </span>
        <span className="muted">Seu plano de estudo começa aqui</span>
      </header>

      <div className="onb-progress">
        <div className="onb-progress-text">
          <span>
            Passo {step + 1} de {STEPS.length}
          </span>
          <strong>{STEPS[step].label}</strong>
        </div>
        <ol className="onb-bars" aria-label={`Passo ${step + 1} de ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s.label} className={i <= step ? "on" : undefined}>
              <span className="sr-only">
                {s.label}
                {i < step ? ", feito" : i === step ? ", atual" : ""}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="onb-head">
        <MyMascot mood={last ? "comemorando" : "feliz"} size={84} background />
        <div>
          <h1 ref={heading} tabIndex={-1}>
            {["Qual prova é o seu foco?", "Quanto tempo você tem por dia?", "Como você quer aparecer?", "Quando é a sua prova?"][step]}
          </h1>
          <p>
            {
              [
                `${firstName ? `Oi, ${firstName}! ` : ""}Escolha a prova para receber questões, revisões e um plano no peso dela.`,
                "Conte o tempo real, não o ideal. O plano do dia cabe nele, com Plantão, revisão e questões novas.",
                "Seu apelido aparece nos rankings. A faculdade é opcional e soma pontos para ela na Liga das Faculdades.",
                "O mês já basta para organizar o caminho até lá. É a última pergunta.",
              ][step]
            }
          </p>
        </div>
      </div>

      <div className="onb-panel">
        {step === 0 && (
          <fieldset>
            <legend className="sr-only">Prova</legend>
            <div className="onb-options">
              {EXAMS.map((exam) => (
                <button key={exam.value} type="button" className="onb-option" aria-pressed={targetExam === exam.value} onClick={() => setTargetExam(exam.value)}>
                  <Icon d={exam.icon} />
                  <span>
                    <strong>{exam.title}</strong>
                    <small>{exam.text}</small>
                  </span>
                  <Check />
                </button>
              ))}
            </div>
            <p className="onb-note">
              <Check /> Mesmas áreas da matriz e questões no estilo da prova. Dá para trocar depois.
            </p>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend className="sr-only">Tempo por dia</legend>
            <div className="onb-grid onb-grid-5">
              {DAILY_MINUTES_OPTIONS.map((value) => (
                <button key={value} type="button" className="onb-tile" aria-pressed={minutes === value} onClick={() => setMinutes(value)}>
                  <strong>{minutesLabel(value)}</strong>
                  <small>≈ {questionsFor(value)} questões</small>
                </button>
              ))}
            </div>
            <p className="onb-note">
              {minutes === null ? (
                "Cada questão leva uns 4 minutos, contando a leitura do comentário."
              ) : (
                <>
                  <Check />
                  {minutes < 45
                    ? "Dá para o Plantão do Dia, que mantém sua sequência acesa."
                    : `O Plantão do Dia e mais ${questionsFor(minutes) - 10} questões entre revisão, erros e áreas fracas.`}
                </>
              )}
            </p>
          </fieldset>
        )}

        {step === 2 && (
          <div className="onb-form">
            <div>
              <label className="label" htmlFor="onb-nickname">
                Apelido nos rankings
              </label>
              <input
                id="onb-nickname"
                className="input"
                value={nickname}
                maxLength={24}
                autoComplete="nickname"
                aria-invalid={!nicknameOk}
                aria-describedby="onb-nickname-hint"
                onChange={(event) => setNickname(event.target.value.replace(/\s/g, ""))}
              />
              <p id="onb-nickname-hint" className="dim" style={{ fontSize: 13, marginTop: 4 }}>
                De 3 a 24 caracteres, sem espaços.
              </p>
            </div>

            <div>
              <p className="label" id="onb-school-label">
                Faculdade (opcional)
              </p>
              {school ? (
                <div className="onb-chosen">
                  <span>
                    <strong>{school.name}</strong>
                    {school.uf ? <small> · {school.uf}</small> : null}
                  </span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSchoolId(null)}>
                    Trocar
                  </button>
                </div>
              ) : (
                <>
                  <input
                    className="input"
                    type="search"
                    placeholder="Buscar pelo nome ou pela sigla do estado"
                    aria-labelledby="onb-school-label"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <ul className="onb-list" aria-label="Faculdades">
                    {matches.map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => setSchoolId(s.id)}>
                          {s.name}
                          {s.uf ? <small>{s.uf}</small> : null}
                        </button>
                      </li>
                    ))}
                    {matches.length === 0 && <li className="onb-empty">Nenhuma faculdade com esse nome. Você pode seguir sem informar.</li>}
                  </ul>
                </>
              )}
              {school && (
                <label className="onb-toggle">
                  <input type="checkbox" checked={showSchool} onChange={(event) => setShowSchool(event.target.checked)} />
                  Mostrar minha faculdade ao lado do apelido
                </label>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <fieldset>
            <legend className="sr-only">Mês da prova</legend>
            <div className="onb-grid onb-grid-4" role="group" aria-label="Ano">
              {[0, 1, 2, 3].map((offset) => {
                const value = thisYear + offset;
                return (
                  <button
                    key={value}
                    type="button"
                    className="onb-tile onb-tile-sm"
                    aria-pressed={year === value}
                    onClick={() => {
                      setYear(value);
                      if (month && !monthAvailable(value, month, today)) setMonth(null);
                    }}
                  >
                    <strong>{value}</strong>
                  </button>
                );
              })}
            </div>
            <div className="onb-grid onb-grid-6" role="group" aria-label="Mês" style={{ marginTop: 8 }}>
              {MONTHS.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className="onb-tile onb-tile-sm"
                  aria-pressed={month === i + 1}
                  disabled={!monthAvailable(year, i + 1, today)}
                  onClick={() => setMonth(i + 1)}
                >
                  <strong>{name}</strong>
                </button>
              ))}
            </div>
            <button type="button" className="onb-option onb-option-row" aria-pressed={month === null} onClick={() => setMonth(null)}>
              <span>
                <strong>Ainda não sei</strong>
              </span>
              <Check />
            </button>
            <p className="onb-note">
              {month === null
                ? "Tudo bem não ter uma data agora. Você define o prazo quando o edital sair."
                : `Prova em ${MONTHS[month - 1].toLowerCase()} de ${year}. Na reta final, o plano ganha simulados semanais.`}
            </p>
          </fieldset>
        )}

        {error && (
          <p className="alert alert-error" role="alert" style={{ marginTop: 14 }}>
            {error}
          </p>
        )}
      </div>

      <div className="onb-nav">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={pending}>
            ‹ Voltar
          </button>
        ) : (
          <Link href="/app" className="btn btn-ghost">
            Agora não
          </Link>
        )}
        <button type="button" className="btn btn-primary" onClick={next} disabled={!canContinue || pending}>
          {last ? (pending ? "Montando..." : "Montar meu percurso →") : "Continuar →"}
        </button>
      </div>
    </div>
  );
}
