"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Cinco destinos. "Estudar" reúne Treino, Revisão e Simulados.
const ITEMS = [
  { href: "/app", label: "Hoje", match: [] as string[], exact: true, icon: "M12 3v18M3 12h18" },
  {
    href: "/app/estudar",
    label: "Estudar",
    match: ["/app/estudar", "/app/treino", "/app/revisao", "/app/simulados", "/app/questao", "/app/plantao"],
    icon: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm4-2v16",
  },
  { href: "/app/ligas", label: "Ligas", match: ["/app/ligas"], icon: "M7 4h10v5a5 5 0 0 1-10 0V4Zm5 10v4m-4 3h8M7 6H4a3 3 0 0 0 3 3m10-3h3a3 3 0 0 1-3 3" },
  { href: "/app/evolucao", label: "Evolução", match: ["/app/evolucao"], icon: "M3 17l6-6 4 4 8-9" },
  { href: "/app/conta", label: "Conta", match: ["/app/conta", "/app/como-funciona"], icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0" },
];

/** Barra inferior no celular; trilho lateral no computador (o CSS troca). */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="appnav" aria-label="Principal">
      <Link href="/app" className="appnav-brand" aria-label="EnaQuest, início">
        <span className="logo" aria-hidden>
          E
        </span>
        <span className="appnav-name">EnaQuest</span>
      </Link>
      <div className="appnav-in">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : item.match.some((prefix) => pathname.startsWith(prefix));
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
