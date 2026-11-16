import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { admin } from "@/lib/supabase/admin";
import { todayBR } from "@/lib/game/streak";
import { currentUser } from "@/lib/server/session";
import { MarketingHeader } from "../../MarketingHeader";
import brand from "../../landing.module.css";
import s from "../tools.module.css";
import { StudyPlanner } from "./StudyPlanner";

export const metadata: Metadata = {
  title: "Plano de estudo para o ENAMED e o ENARE",
  description: "Monte grátis um plano semana a semana até a prova, com o tempo de cada área no peso do ENAMED.",
};

export default async function StudyPlanPage() {
  const [user, { data: areas }] = await Promise.all([
    currentUser(),
    admin().from("matrix_areas").select("id, name, color, exam_share").order("sort_order"),
  ]);
  return (
    <div className={brand.page}>
      <MarketingHeader signedIn={Boolean(user)} tools />
      <main className={s.main}>
        <header className={s.intro}>
          <Link href="/ferramentas" className={s.back}>← Ferramentas grátis</Link>
          <p className={s.kicker}>Plano de estudo</p>
          <h1>Sua rota <em>até a prova</em></h1>
          <p className={s.lead}>Informe a data e o tempo que você tem. O plano mostra as fases e quanto estudar de cada área por semana.</p>
        </header>
        <StudyPlanner
          today={todayBR()}
          signedIn={Boolean(user)}
          areas={(areas ?? []).map((a: { id: string; name: string; color: string; exam_share: number | string }) => ({ id: a.id, name: a.name, color: a.color, share: Number(a.exam_share) }))}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
