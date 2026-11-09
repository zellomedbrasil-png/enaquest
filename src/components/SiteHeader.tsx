import Link from "next/link";
import { currentUser } from "@/lib/server/session";

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="wrap-wide" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px" }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <span className="logo" aria-hidden>
          E
        </span>
        <span className="display" style={{ fontSize: 20 }}>
          EnaQuest
        </span>
      </Link>
      <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Link href="/planos" className="btn btn-ghost btn-sm">
          Planos
        </Link>
        <Link href={user ? "/app" : "/entrar"} className="btn btn-primary btn-sm">
          {user ? "Abrir o app" : "Entrar"}
        </Link>
      </nav>
    </header>
  );
}
