import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { admin } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/server/session";
import { MarketingHeader } from "../../MarketingHeader";
import brand from "../../landing.module.css";
import s from "../tools.module.css";
import { LevelTest } from "./LevelTest";

export const metadata: Metadata = {
  title: "Teste de nível para o ENAMED e o ENARE",
  description: "Responda 10 questões no estilo da prova, veja a correção na hora e descubra seu acerto por área. Grátis e sem cadastro.",
};

export default async function LevelTestPage() {
  const [user, { data: areas }] = await Promise.all([currentUser(), admin().from("matrix_areas").select("id, name, color").order("sort_order")]);
  return (
    <div className={brand.page}>
      <MarketingHeader signedIn={Boolean(user)} tools />
      <main className={s.main}>
        <header className={s.intro}>
          <Link href="/ferramentas" className={s.back}>← Ferramentas grátis</Link>
          <p className={s.kicker}>Teste de nível</p>
          <h1>Quanto você acertaria <em>hoje?</em></h1>
          <p className={s.lead}>10 questões no estilo do ENAMED e do ENARE, no peso de cada área da prova.</p>
        </header>
        <LevelTest areas={areas ?? []} signedIn={Boolean(user)} />
      </main>
      <SiteFooter />
    </div>
  );
}
