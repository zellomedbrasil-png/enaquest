import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { listPublicExams } from "@/lib/server/public-exams";
import { currentUser } from "@/lib/server/session";
import { MarketingHeader } from "../MarketingHeader";
import brand from "../landing.module.css";
import s from "../ferramentas/tools.module.css";

export const metadata: Metadata = {
  title: "Provas oficiais do ENAMED e do ENARE comentadas",
  description: "Provas oficiais do ENAMED e do ENARE com gabarito da banca e comentário de cada alternativa. Veja algumas questões grátis.",
};

export const revalidate = 3600;

export default async function ExamsIndexPage() {
  const [user, exams] = await Promise.all([currentUser(), listPublicExams()]);
  return (
    <div className={brand.page}>
      <MarketingHeader signedIn={Boolean(user)} tools />
      <main className={s.main}>
        <header className={s.intro}>
          <p className={s.kicker}>Provas oficiais</p>
          <h1>Provas do ENAMED e do ENARE, <em>comentadas</em></h1>
          <p className={s.lead}>Cada questão com o gabarito da banca e o comentário de cada alternativa. Questões anuladas ficam de fora da contagem.</p>
        </header>
        {exams.length === 0 ? (
          <section className={s.panel}><p className={s.lead}>As primeiras provas estão sendo comentadas.</p></section>
        ) : (
          <div className={s.toolGrid}>
            {exams.map((exam) => (
              <Link key={exam.id} href={`/provas/${exam.id}`} className={s.tool}>
                <h2>{exam.name}{exam.booklet ? `, ${exam.booklet}` : ""}</h2>
                <p>
                  {exam.board} · gabarito {exam.keyStatus}. {exam.valid} questões comentadas
                  {exam.annulled ? `, mais ${exam.annulled} anuladas ou excluídas pela banca` : ""}.
                </p>
                <span className={s.go}>Ver a prova →</span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
