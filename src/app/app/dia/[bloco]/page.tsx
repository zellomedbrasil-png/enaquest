import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PremiumGate } from "@/components/PremiumGate";
import { QuestionRunner } from "@/components/QuestionRunner";
import { Banner, PageHeader } from "@/components/ui";
import { admin } from "@/lib/supabase/admin";
import { startDayBlock } from "@/lib/server/day-plan";
import { isPremium, requireUser } from "@/lib/server/session";

const BLOCKS = {
  revisao: { title: "Revisão do dia", lead: "As questões que voltaram para você hoje." },
  erros: { title: "Erros para refazer", lead: "Questões que você errou e ainda não voltaram na revisão." },
  novas: { title: "Questões novas", lead: "No peso da prova, com mais questões nas áreas em que você vai pior." },
} as const;

type BlockKind = keyof typeof BLOCKS;

export const metadata: Metadata = { title: "Seu dia" };

export default async function DayBlockPage({ params }: { params: Promise<{ bloco: string }> }) {
  const { bloco } = await params;
  if (!(bloco in BLOCKS)) notFound();
  const kind = bloco as BlockKind;
  const user = await requireUser();
  if (!(await isPremium(user.id))) {
    return <PremiumGate title="Seu dia completo" text="Revisão, erros para refazer e questões novas nas suas áreas fracas, dentro do tempo que você tem." />;
  }

  const [round, { data: areas }] = await Promise.all([
    startDayBlock(user.id, kind),
    admin().from("matrix_areas").select("id, name, color").order("sort_order"),
  ]);
  const info = BLOCKS[kind];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader title={info.title} lead={info.lead} />
      {round.questions.length === 0 ? (
        <Banner
          tone="done"
          title="Este bloco está feito"
          text="Volte para Seu dia para ver o próximo passo."
          action={
            <Link href="/app" className="btn btn-dark">
              Voltar para Seu dia
            </Link>
          }
        />
      ) : (
        <QuestionRunner
          key={round.context}
          questions={round.questions}
          mode={round.mode}
          context={round.context}
          areas={areas ?? []}
          doneHref="/app"
          doneLabel="Voltar para Seu dia"
        />
      )}
    </div>
  );
}
