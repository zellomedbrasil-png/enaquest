import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { QuestionImages } from "@/components/QuestionView";
import { getPublicExam } from "@/lib/server/public-exams";
import { currentUser } from "@/lib/server/session";
import { LETTERS } from "@/lib/ui/labels";
import { MarketingHeader } from "../../MarketingHeader";
import brand from "../../landing.module.css";
import s from "../../ferramentas/tools.module.css";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getPublicExam(id);
  if (!data) return { title: "Prova não encontrada" };
  const name = `${data.exam.name}${data.exam.booklet ? `, ${data.exam.booklet}` : ""}`;
  return {
    title: `${name}: questões comentadas`,
    description: `Resolva questões do ${name} com gabarito da banca e comentário de cada alternativa.`,
  };
}

export default async function PublicExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, data] = await Promise.all([currentUser(), getPublicExam(id)]);
  if (!data) notFound();
  const { exam, sample } = data;
  const name = `${exam.name}${exam.booklet ? `, ${exam.booklet}` : ""}`;
  return (
    <div className={brand.page}>
      <MarketingHeader signedIn={Boolean(user)} tools />
      <main className={s.main}>
        <header className={s.intro}>
          <Link href="/provas" className={s.back}>← Provas oficiais</Link>
          <p className={s.kicker}>{exam.board} · gabarito {exam.keyStatus}</p>
          <h1>{name}</h1>
          <p className={s.lead}>
            {exam.valid} questões comentadas
            {exam.annulled ? `, mais ${exam.annulled} anuladas ou excluídas pela banca` : ""}. Veja as primeiras e resolva com a correção na hora.
          </p>
        </header>

        <div style={{ display: "grid", gap: 18 }}>
          {sample.map((question) => (
            <article key={question.id} className={s.panel} aria-label={`Questão ${question.official?.number}`}>
              <p className={s.kicker}>Questão {question.official?.number}</p>
              <p className="stem" style={{ whiteSpace: "pre-line" }}>{question.stem}</p>
              <QuestionImages images={question.images} />
              <ol className={s.publicOptions}>
                {question.options.map((text, i) => (
                  <li key={i}><strong>{LETTERS[i]}.</strong> {text}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>

        <section className={s.panel} style={{ marginTop: 18 }}>
          <h2 className={s.subTitle}>Gabarito e comentário</h2>
          <p className={s.lead}>
            Crie uma conta grátis para resolver as 10 primeiras questões desta prova com o gabarito, o comentário de cada alternativa e os quatro cartões de estudo.
          </p>
          <div className={s.actions}>
            <Link className={s.primary} href={user ? "/app/provas" : "/cadastrar"}>
              {user ? "Abrir a prova no app" : "Criar conta grátis"} <span aria-hidden="true">→</span>
            </Link>
            <Link className={s.secondary} href="/ferramentas/o-que-cai">Ver o que cai por área</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
