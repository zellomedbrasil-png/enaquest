import Link from "next/link";
import { requireEditor } from "@/lib/server/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireEditor();
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px" }}>
      <header style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <strong className="display" style={{ fontSize: 20, marginRight: "auto" }}>
          Painel editorial
        </strong>
        <Link href="/admin" className="btn btn-ghost btn-sm">
          Lotes
        </Link>
        <Link href="/admin/moderacao" className="btn btn-ghost btn-sm">
          Moderação
        </Link>
        <Link href="/app" className="btn btn-ghost btn-sm">
          Voltar ao app
        </Link>
      </header>
      {children}
    </div>
  );
}
