"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/app", label: "Hoje", exact: true, icon: "M12 3v18M3 12h18" },
  { href: "/app/treino", label: "Treino", icon: "M4 19V9m5 10V5m6 14v-7m5 7V8" },
  { href: "/app/simulados", label: "Simulados", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  { href: "/app/revisao", label: "Revisão", icon: "M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15m0 5v-5h5" },
  { href: "/app/ligas", label: "Ligas", icon: "M7 4h10v5a5 5 0 0 1-10 0V4Zm5 10v4m-4 3h8M7 6H4a3 3 0 0 0 3 3m10-3h3a3 3 0 0 1-3 3" },
  { href: "/app/evolucao", label: "Evolução", icon: "M3 17l6-6 4 4 8-9" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="bottomnav" aria-label="Principal">
      <div className="bottomnav-in">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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
