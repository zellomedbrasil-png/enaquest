import type { Metadata } from "next";
import Link from "next/link";
import { MascotPicker } from "@/components/MascotPicker";
import { PageHeader } from "@/components/ui";
import { getMascotForPage } from "@/lib/server/mascot";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Mascote" };

export default async function MascotPage() {
  const user = await requireUser();
  const view = await getMascotForPage(user.id);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PageHeader title="Seu mascote" lead="Toda jornada fica melhor com companhia." />
      <MascotPicker initial={view} />
      <p className="muted" style={{ fontSize: 14.5 }}>
        Procurando seu perfil ou a assinatura? <Link href="/app/conta">Abrir Conta</Link>.
      </p>
    </div>
  );
}
