import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { currentUser } from "@/lib/server/session";
import { MarketingHeader } from "../MarketingHeader";
import brand from "../landing.module.css";
import s from "./tools.module.css";

export const metadata: Metadata = {
  title: "Ferramentas grátis para o ENAMED e o ENARE",
  description: "Teste de nível com 10 questões e plano de estudo semana a semana até a prova. Grátis e sem cadastro.",
};

export default async function ToolsPage() {
  const user = await currentUser();
  return (
    <div className={brand.page}>
      <MarketingHeader signedIn={Boolean(user)} tools />
      <main className={s.main}>
        <header className={s.intro}>
          <p className={s.kicker}>Ferramentas grátis</p>
          <h1>Comece sua preparação <em>hoje</em></h1>
          <p className={s.lead}>Descubra seu nível e monte um plano até a prova do ENAMED ou do ENARE. Sem cadastro e sem cartão.</p>
        </header>

        <div className={s.toolGrid}>
          <Link href="/ferramentas/teste-de-nivel" className={s.tool}>
            <span className={s.toolIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></svg>
            </span>
            <h2>Teste de nível</h2>
            <p>10 questões no estilo da prova, sorteadas no peso de cada área. Correção na hora e seu retrato por área no final.</p>
            <span className={s.go}>Fazer o teste →</span>
          </Link>
          <Link href="/ferramentas/plano-de-estudo" className={s.tool}>
            <span className={s.toolIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /></svg>
            </span>
            <h2>Plano de estudo até a prova</h2>
            <p>Informe a data da prova e as horas da sua semana. O plano divide as fases e o tempo por área, com reforço no que você acha mais difícil.</p>
            <span className={s.go}>Montar meu plano →</span>
          </Link>
        </div>

        <section className={s.soon} aria-labelledby="em-breve">
          <h2 id="em-breve">Em breve</h2>
          <p>
            O que mais cai em cada área, com base nas provas oficiais comentadas, e um radar com as datas e mudanças do edital.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
