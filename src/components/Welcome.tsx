"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MyMascot } from "./MyMascot";
import { ProfileForm } from "./ProfileForms";

const STEPS = [
  {
    title: "Todo dia tem um Plantão",
    text: "São 10 questões iguais para todo mundo, todo dia, sempre grátis. Fazer o Plantão mantém acesa a sua sequência de dias seguidos.",
  },
  {
    title: "Cada resposta vem explicada",
    text: "Depois de responder, você lê o raciocínio em camadas. O que você erra volta na Revisão, na hora certa para não esquecer.",
  },
  {
    title: "Seu rating mostra seu nível",
    text: "As 20 primeiras questões calibram o seu rating, e errar nelas custa pouco. Depois você recebe uma patente e entra nas ligas semanais.",
  },
];

export function Welcome({
  nickname,
  schoolId,
  showSchool,
  schools,
}: {
  nickname: string;
  schoolId: string | null;
  showSchool: boolean;
  schools: { id: string; name: string; uf: string | null }[];
}) {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const last = step === STEPS.length;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  return (
    <section className="card welcome" aria-labelledby="welcome-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <p className="eyebrow">
          Passo {step + 1} de {STEPS.length + 1}
        </p>
        <Link href="/app" className="muted" style={{ fontSize: 14.5 }}>
          Pular
        </Link>
      </div>
      <div className="bar level" style={{ margin: "8px 0 16px" }} role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length + 1} aria-label="Passos de boas-vindas">
        <i style={{ width: `${((step + 1) / (STEPS.length + 1)) * 100}%` }} />
      </div>

      <div style={{ display: "grid", justifyItems: "center", marginBottom: 8 }}>
        <MyMascot mood={last ? "comemorando" : "feliz"} size={120} background />
      </div>

      {!last ? (
        <>
          <h1 id="welcome-title" ref={heading} tabIndex={-1} style={{ fontSize: 28 }}>
            {STEPS[step].title}
          </h1>
          <p style={{ marginTop: 10, fontSize: 17 }}>{STEPS[step].text}</p>
        </>
      ) : (
        <>
          <h1 id="welcome-title" ref={heading} tabIndex={-1} style={{ fontSize: 28 }}>
            Escolha como aparecer
          </h1>
          <p className="muted" style={{ margin: "10px 0 14px" }}>
            Seu apelido aparece nos rankings. A faculdade é opcional e soma pontos para ela na Liga das Faculdades.
          </p>
          <ProfileForm nickname={nickname} schoolId={schoolId} showSchool={showSchool} schools={schools} />
        </>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
        {step > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
            Voltar
          </button>
        )}
        {!last ? (
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(step + 1)}>
            Próximo
          </button>
        ) : (
          <Link href="/app/plantao" className="btn btn-primary" style={{ flex: 1 }}>
            Fazer meu primeiro Plantão
          </Link>
        )}
      </div>
    </section>
  );
}
