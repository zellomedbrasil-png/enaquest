import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { todayBR } from "@/lib/game/streak";
import { CHANGES, CHECKED_ON, CONFIDENCE_LABEL, EVENTS, classify, type Confidence } from "@/lib/radar";
import { currentUser } from "@/lib/server/session";
import { MarketingHeader } from "../../MarketingHeader";
import brand from "../../landing.module.css";
import s from "../tools.module.css";

export const metadata: Metadata = {
  title: "Radar do edital: datas e mudanças do Enamed e do Enare",
  description: "Datas do Enamed e do Enare, o que mudou nas regras e de onde veio cada informação, com a data da última conferência.",
};

export const revalidate = 3600;

const TOPIC: Record<"enamed" | "enare", string> = { enamed: "Enamed", enare: "Enare" };

function Badge({ confidence }: { confidence: Confidence }) {
  return <span className={`${s.radarBadge} ${confidence === "oficial" ? s.radarOficial : s.radarAviso}`}>{CONFIDENCE_LABEL[confidence]}</span>;
}

function formatDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function RadarPage() {
  const user = await currentUser();
  const events = classify(EVENTS, todayBR());
  const next = events.find((e) => e.status === "proximo");
  return (
    <div className={brand.page}>
      <MarketingHeader signedIn={Boolean(user)} tools />
      <main className={s.main}>
        <header className={s.intro}>
          <Link href="/ferramentas" className={s.back}>← Ferramentas grátis</Link>
          <p className={s.kicker}>Radar do edital</p>
          <h1>Datas e mudanças do <em>Enamed e do Enare</em></h1>
          <p className={s.lead}>
            Cada informação traz a fonte e o tipo dela: oficial ou de portal. Conferido em {formatDay(CHECKED_ON)}. Em caso de divergência, vale o edital.
          </p>
        </header>

        {next && (
          <section className={`${s.panel} ${s.radarNext}`} aria-labelledby="proximo">
            <p className={s.kicker} id="proximo">Próxima data</p>
            <h2 className={s.bandTitle}>{next.title}</h2>
            <p className={s.radarDate}>{next.dateLabel}</p>
            <p className={s.lead}>
              {next.daysLeft === 0 ? "É hoje." : next.daysLeft === 1 ? "Falta 1 dia." : `Faltam ${next.daysLeft} dias.`} {next.detail}
            </p>
            <p className={s.note}>
              <Badge confidence={next.confidence} /> Fonte: <a href={next.source.url} target="_blank" rel="noopener noreferrer">{next.source.title}</a>
            </p>
          </section>
        )}

        <section className={s.panel} style={{ marginTop: 18 }} aria-labelledby="linha">
          <h2 id="linha" className={s.subTitle}>Linha do tempo da edição 2026/2027</h2>
          <ol className={s.radarList}>
            {events.map((event) => (
              <li key={event.id} className={event.status === "passou" ? s.radarPast : undefined}>
                <div className={s.radarTop}>
                  <span className={s.radarTopic}>{TOPIC[event.topic]}</span>
                  <span className={s.radarState}>
                    {event.status === "passou" ? "Já ocorreu" : event.status === "proximo" ? "Próxima" : "Em breve"}
                  </span>
                </div>
                <h3>{event.title}</h3>
                <p className={s.radarDate}>{event.dateLabel}</p>
                <p>{event.detail}</p>
                <p className={s.note}>
                  <Badge confidence={event.confidence} /> <a href={event.source.url} target="_blank" rel="noopener noreferrer">{event.source.title}</a>
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className={s.panel} style={{ marginTop: 18 }} aria-labelledby="mudancas">
          <h2 id="mudancas" className={s.subTitle}>O que mudou nas regras</h2>
          <ul className={s.radarList}>
            {CHANGES.map((change) => (
              <li key={change.id}>
                <div className={s.radarTop}><span className={s.radarTopic}>{TOPIC[change.topic]}</span></div>
                <h3>{change.title}</h3>
                <p>{change.detail}</p>
                <p className={s.note}>
                  <Badge confidence={change.confidence} /> <a href={change.source.url} target="_blank" rel="noopener noreferrer">{change.source.title}</a>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className={s.actions} style={{ marginTop: 22 }}>
          <Link className={s.primary} href="/ferramentas/plano-de-estudo">Montar meu plano de estudo <span aria-hidden="true">→</span></Link>
          <Link className={s.secondary} href="/provas">Ver as provas oficiais comentadas</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
