"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildPlan, QUESTIONS_PER_HOUR, type PlanArea } from "@/lib/study/plan";
import s from "../tools.module.css";

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function StudyPlanner({ today, areas, signedIn }: { today: string; areas: PlanArea[]; signedIn: boolean }) {
  const [examDate, setExamDate] = useState("");
  const [hours, setHours] = useState(15);
  const [weak, setWeak] = useState<string[]>([]);
  const plan = useMemo(
    () => (examDate ? buildPlan({ today, examDate, hoursPerWeek: hours, weakAreas: weak, areas }) : null),
    [today, examDate, hours, weak, areas],
  );
  const toggle = (id: string) => setWeak((all) => (all.includes(id) ? all.filter((a) => a !== id) : [...all, id]));

  return (
    <div className={s.plannerGrid}>
      <form className={s.panel} onSubmit={(e) => e.preventDefault()} aria-label="Dados do seu plano">
        <label className={s.field}>
          <span>Data da sua prova</span>
          <input type="date" value={examDate} min={addDays(today, 7)} onChange={(e) => setExamDate(e.target.value)} required />
          <small>Confira a data no edital da sua prova.</small>
        </label>

        <label className={s.field}>
          <span>
            Horas de estudo por semana: <strong>{hours} h</strong>
          </span>
          <input type="range" min={2} max={60} step={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          <small>Conte só o tempo de estudo de verdade, fora plantão e aula.</small>
        </label>

        <fieldset className={s.field}>
          <legend>Áreas em que você tem mais dificuldade</legend>
          <div className={s.chips}>
            {areas.map((area) => (
              <button key={area.id} type="button" aria-pressed={weak.includes(area.id)} onClick={() => toggle(area.id)}>
                <i style={{ background: area.color }} aria-hidden="true" /> {area.name}
              </button>
            ))}
          </div>
          <small>Essas áreas ganham 50% a mais de tempo.</small>
        </fieldset>
      </form>

      <section className={s.panel} aria-live="polite" aria-label="Seu plano">
        {!plan ? (
          <div className={s.placeholder}>
            <p className={s.kicker}>Seu plano</p>
            <p>{examDate ? "Escolha uma data a pelo menos uma semana de hoje." : "Escolha a data da prova para ver o plano semana a semana."}</p>
          </div>
        ) : (
          <>
            <p className={s.kicker}>Até {formatDay(examDate)}</p>
            <div className={s.stats}>
              <div><strong>{plan.weeks}</strong><span>semanas</span></div>
              <div><strong>{plan.questionsPerWeek}</strong><span>questões por semana</span></div>
              <div><strong>{plan.simulados}</strong><span>simulados</span></div>
            </div>

            <h2 className={s.subTitle}>As fases</h2>
            <ol className={s.phases}>
              {plan.phases.map((phase) => (
                <li key={phase.key}>
                  <strong>{phase.title}</strong> <span className={s.weeks}>{phase.weeks} {phase.weeks === 1 ? "semana" : "semanas"}</span>
                  <p>{phase.focus}</p>
                </li>
              ))}
            </ol>

            <h2 className={s.subTitle}>Sua semana por área</h2>
            <ul className={s.areaPlan}>
              {plan.areas.map((area) => (
                <li key={area.id}>
                  <div>
                    <span><i style={{ background: area.color }} aria-hidden="true" /> {area.name}{area.weak && <em> · reforço</em>}</span>
                    <strong>{area.hours.toLocaleString("pt-BR")} h · {area.questions} questões</strong>
                  </div>
                  <div className={s.meter} aria-hidden="true"><i style={{ width: `${area.pct}%`, background: area.color }} /></div>
                </li>
              ))}
            </ul>
            <p className={s.note}>
              O peso de cada área segue a distribuição medida no caderno do ENAMED 2026. O ritmo sugerido é metade do tempo em questões, a cerca de{" "}
              {QUESTIONS_PER_HOUR} por hora contando a leitura do comentário. Ao todo, cerca de {plan.totalQuestions.toLocaleString("pt-BR")} questões até a prova.
            </p>
            <div className={s.actions}>
              <Link className={s.primary} href={signedIn ? "/app" : "/cadastrar"}>
                {signedIn ? "Começar pelo Plantão de hoje" : "Criar conta grátis e começar hoje"} <span aria-hidden="true">→</span>
              </Link>
              <button type="button" className={s.secondary} onClick={() => window.print()}>Imprimir plano</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
