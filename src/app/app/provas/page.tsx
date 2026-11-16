import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { OfficialExamsClient } from "@/components/OfficialExamsClient";
import { PageHeader } from "@/components/ui";
import { admin } from "@/lib/supabase/admin";
import { FREE_OFFICIAL_QUESTIONS, listOfficialExams } from "@/lib/server/official";
import { isPremium, requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Provas oficiais" };

export default async function OfficialExamsPage() {
  const user = await requireUser();
  const [exams, premium, { data: areas }] = await Promise.all([
    listOfficialExams(user.id),
    isPremium(user.id),
    admin().from("matrix_areas").select("id, name, color").order("sort_order"),
  ]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader
        title="Provas oficiais"
        lead="Resolva as provas do ENAMED e do ENARE na ordem do caderno, com o gabarito da banca e o comentário do EnaQuest em cada alternativa."
      />

      {exams.length === 0 ? (
        <EmptyState
          title="As primeiras provas estão sendo comentadas"
          action={
            <Link href="/app/treino" className="btn btn-primary">
              Treinar enquanto isso
            </Link>
          }
        >
          A primeira será o ENAMED 2025, que também vale para o acesso direto do ENARE. Cada questão chega com o gabarito oficial e o comentário de cada
          alternativa. Questões anuladas ficam de fora da contagem.
        </EmptyState>
      ) : (
        <>
          <OfficialExamsClient exams={exams} areas={areas ?? []} premium={premium} freeLimit={FREE_OFFICIAL_QUESTIONS} />
          <p className="muted" style={{ fontSize: 14 }}>
            {premium
              ? "Você continua de onde parou. Questões anuladas pela banca e questões que ficaram desatualizadas não entram nos blocos."
              : `No plano grátis, cada prova libera as ${FREE_OFFICIAL_QUESTIONS} primeiras questões. A prova inteira faz parte da assinatura.`}
          </p>
        </>
      )}
    </div>
  );
}
