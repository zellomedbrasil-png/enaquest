import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SimuladoRunner } from "@/components/SimuladoRunner";
import { admin } from "@/lib/supabase/admin";
import { startOrResumeSimulado } from "@/lib/server/simulados";
import { AppError, requireUser } from "@/lib/server/session";
import { z } from "zod";

export const metadata: Metadata = { title: "Simulado" };

export default async function SimuladoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const { data: areas } = await admin().from("matrix_areas").select("id, name, color");

  let attempt;
  try {
    attempt = await startOrResumeSimulado(user.id, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "premium_required") redirect("/app/simulados");
    if (error instanceof AppError && error.code === "closed") redirect("/app/simulados");
    if (error instanceof AppError && error.code === "not_found") notFound();
    throw error;
  }
  if (attempt.finished) redirect(`/app/simulados/${id}/resultado`);

  return <SimuladoRunner attempt={attempt} areas={areas ?? []} />;
}
