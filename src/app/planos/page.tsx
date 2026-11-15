import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { currentUser } from "@/lib/server/session";
import { MarketingHeader } from "../MarketingHeader";
import brand from "../landing.module.css";
import s from "./plans.module.css";

export const metadata: Metadata = {
  title: "Planos",
  description: "Compare o Plantão do Dia gratuito com a assinatura mensal do EnaQuest para ENAMED e ENARE.",
};

const freeFeatures = ["10 questões no Plantão do Dia", "Comentários completos das questões do dia", "Discussão das questões com a turma", "XP, patentes, sequência e ligas"];
const paidFeatures = ["Treino ilimitado por área", "Revisão espaçada e caderno de erros", "Simulados completos com percentil", "Termômetro de Proficiência por área"];

function Benefits({ title, items }: { title: string; items: string[] }) {
  return <div className={s.benefits}>
    <h3>{title}</h3>
    <ul>{items.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
  </div>;
}

export default async function PlansPage() {
  const user = await currentUser();
  return (
    <div className={brand.page}>
      <MarketingHeader signedIn={Boolean(user)} plans />
      <main className={s.main}>
        <header className={s.intro}>
          <p className={s.kicker}>Planos EnaQuest</p>
          <h1>Como você quer <em>estudar?</em></h1>
          <p>Faça o plantão diário com a turma ou monte uma rotina de treino por área.</p>
        </header>
        <div className={s.grid}>
          <article className={s.card}>
            <div className={s.band}>
              <Image src="/campanha/estudo.webp" fill sizes="(max-width: 700px) 95vw, 510px" alt="" />
              <h2>Grátis</h2>
            </div>
            <div className={s.body}>
              <p className={s.price}>R$ 0</p>
              <p className={s.detail}>Acesso diário, sem cartão de crédito.</p>
              <Link className={s.button} href={user ? "/app" : "/cadastrar"}>{user ? "Abrir meu plantão" : "Criar conta grátis"} <span aria-hidden="true">→</span></Link>
              <Benefits title="Incluído no plano grátis" items={freeFeatures} />
            </div>
          </article>
          <article className={s.premium}>
            <div className={s.band}>
              <Image src="/campanha/plantao.webp" fill sizes="(max-width: 700px) 95vw, 510px" alt="" />
              <h2>Assinatura</h2>
            </div>
            <div className={s.body}>
              <p className={s.price}>R$ 29 <small>/ mês</small></p>
              <p className={s.detail}>Cobrança mensal. Cancele quando quiser.</p>
              <Link className={s.button} href="/assinar">Assinar plano mensal <span aria-hidden="true">→</span></Link>
              <Benefits title="Tudo do grátis, mais" items={paidFeatures} />
            </div>
          </article>
        </div>
        <section className={s.billing} aria-labelledby="pagamento">
          <h2 id="pagamento">Pagamento e cancelamento</h2>
          <div className={s.terms}>
            <div><h3>Como posso pagar?</h3><p>Use cartão de crédito Visa ou Mastercard, Google Pay ou Apple Pay. Por enquanto, não aceitamos cartão de débito, Pix, Elo, Hipercard nem American Express.</p></div>
            <div><h3>Como funciona o cancelamento?</h3><p>Cancele pela sua conta e use o plano até o fim do período pago. Você pode pedir reembolso em até 7 dias após o primeiro pagamento.</p><Link href="/termos">Ler os termos de uso →</Link></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
