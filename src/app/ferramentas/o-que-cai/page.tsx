import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { getIncidence } from "@/lib/server/incidence";
import { currentUser } from "@/lib/server/session";
import { MarketingHeader } from "../../MarketingHeader";
import brand from "../../landing.module.css";
import s from "../tools.module.css";

export const metadata: Metadata = {
  title: "O que cai no ENAMED e no ENARE: temas por área",
  description: "Veja quantas questões de cada área e quais temas apareceram nas provas oficiais comentadas do EnaQuest.",
};

export const revalidate = 3600;

export default async function IncidencePage() {
  const [user, data] = await Promise.all([currentUser(), getIncidence()]);
  const max = Math.max(1, ...data.areas.map((a) => a.pct));
  return (
    <div className={brand.page}>
      <MarketingHeader signedIn={Boolean(user)} tools />
      <main className={s.main}>
        <header className={s.intro}>
          <Link href="/ferramentas" className={s.back}>← Ferramentas grátis</Link>
          <p className={s.kicker}>O que cai</p>
          <h1>Quais áreas e temas <em>aparecem na prova</em></h1>
          <p className={s.lead}>
            A contagem vem das provas oficiais que já estão comentadas no EnaQuest. Questões anuladas ou excluídas pela banca ficam de fora.
          </p>
        </header>

        {data.total === 0 ? (
          <section className={s.panel}>
            <p className={s.lead}>As primeiras provas estão sendo comentadas. Em breve esta página mostra a incidência por área e por tema.</p>
          </section>
        ) : (
          <>
            <section className={s.panel} aria-labelledby="areas">
              <h2 id="areas" className={s.subTitle}>Questões por área</h2>
              <p className={s.note}>
                Base: {data.exams.map((e) => `${e.name}${e.booklet ? ` (${e.booklet})` : ""}, ${e.valid} questões válidas`).join("; ")}.
                {data.exams.length < 2 && " Com apenas uma prova na base, trate a lista como retrato daquela edição, e não como tendência."}
              </p>
              <ul className={s.incidence}>
                {data.areas.map((area) => (
                  <li key={area.id}>
                    <div className={s.incidenceHead}>
                      <span><i style={{ background: area.color }} aria-hidden="true" /> {area.name}</span>
                      <strong>{area.count} questões · {area.pct}%</strong>
                    </div>
                    <div className={s.meter} aria-hidden="true"><i style={{ width: `${(area.pct / max) * 100}%`, background: area.color }} /></div>
                    <small>Peso da área na matriz medida no ENAMED 2026: {area.matrixPct}%</small>
                  </li>
                ))}
              </ul>
            </section>

            <section className={s.panel} aria-labelledby="temas" style={{ marginTop: 18 }}>
              <h2 id="temas" className={s.subTitle}>Temas que apareceram</h2>
              {data.areas.filter((a) => a.count > 0).map((area) => (
                <details key={area.id} className={s.themes}>
                  <summary>
                    <i style={{ background: area.color }} aria-hidden="true" /> {area.name} <span>{area.count}</span>
                  </summary>
                  <ul>
                    {area.themes.map((t, i) => (
                      <li key={`${t.theme}-${i}`}>{t.theme} <small>{t.scenario}</small></li>
                    ))}
                  </ul>
                </details>
              ))}
            </section>

            <div className={s.actions} style={{ marginTop: 22 }}>
              <Link className={s.primary} href={user ? "/app/provas" : "/cadastrar"}>
                {user ? "Resolver as provas oficiais" : "Criar conta grátis e resolver as provas"} <span aria-hidden="true">→</span>
              </Link>
              <Link className={s.secondary} href="/ferramentas/plano-de-estudo">Montar meu plano de estudo</Link>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
