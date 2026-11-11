"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; match: string[]; exact?: boolean; icon: string };

const ICON = {
  hoje: "M12 3v18M3 12h18",
  plantao: "M3 12h4l3-8 4 16 3-8h4",
  estudar: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm4-2v16",
  revisao: "M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15m0 5v-5h5",
  treino: "M4 19V9m5 10V5m6 14v-7m5 7V8",
  simulados: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  ligas: "M7 4h10v5a5 5 0 0 1-10 0V4Zm5 10v4m-4 3h8M7 6H4a3 3 0 0 0 3 3m10-3h3a3 3 0 0 1-3 3",
  evolucao: "M3 17l6-6 4 4 8-9",
  mascote: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.500 14.500a4.500 4.500 0 0 0 7 0M9 10h.01M15 10h.01",
  ajuda: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.6.300-1 .8-1 1.500M12 17h.01",
  conta: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
};

// Celular: cinco destinos na barra inferior. "Estudar" reúne Treino, Revisão e Simulados.
const MOBILE: Item[] = [
  { href: "/app", label: "Hoje", match: [], exact: true, icon: ICON.hoje },
  { href: "/app/estudar", label: "Estudar", match: ["/app/estudar", "/app/treino", "/app/revisao", "/app/simulados", "/app/questao", "/app/plantao"], icon: ICON.estudar },
  { href: "/app/ligas", label: "Ligas", match: ["/app/ligas"], icon: ICON.ligas },
  { href: "/app/evolucao", label: "Evolução", match: ["/app/evolucao"], icon: ICON.evolucao },
  { href: "/app/mascote", label: "Mascote", match: ["/app/mascote"], icon: ICON.mascote },
];

// Computador: cada ferramenta a um clique, em grupos.
const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Hoje",
    items: [
      { href: "/app", label: "Hoje", match: [], exact: true, icon: ICON.hoje },
      { href: "/app/plantao", label: "Plantão do Dia", match: ["/app/plantao"], icon: ICON.plantao },
    ],
  },
  {
    label: "Estudar",
    items: [
      { href: "/app/revisao", label: "Revisão", match: ["/app/revisao"], icon: ICON.revisao },
      { href: "/app/treino", label: "Treino", match: ["/app/treino", "/app/questao"], icon: ICON.treino },
      { href: "/app/simulados", label: "Simulados", match: ["/app/simulados"], icon: ICON.simulados },
    ],
  },
  {
    label: "Acompanhar",
    items: [
      { href: "/app/evolucao", label: "Evolução", match: ["/app/evolucao"], icon: ICON.evolucao },
      { href: "/app/ligas", label: "Ligas", match: ["/app/ligas"], icon: ICON.ligas },
      { href: "/app/mascote", label: "Mascote", match: ["/app/mascote"], icon: ICON.mascote },
    ],
  },
];

const FOOT: Item[] = [
  { href: "/app/como-funciona", label: "Como funciona", match: ["/app/como-funciona"], icon: ICON.ajuda },
  { href: "/app/conta", label: "Conta", match: ["/app/conta"], icon: ICON.conta },
];

function Svg({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
}

/** Barra inferior no celular; trilho lateral agrupado no computador (o CSS troca). */
export function AppNav({ dueReviews = 0 }: { dueReviews?: number }) {
  const pathname = usePathname();
  const isActive = (item: Item) => (item.exact ? pathname === item.href : item.match.some((prefix) => pathname.startsWith(prefix)));

  return (
    <nav className="appnav" aria-label="Principal">
      <Link href="/app" className="appnav-brand" aria-label="EnaQuest, início">
        <span className="logo" aria-hidden>
          E
        </span>
        <span className="appnav-name">EnaQuest</span>
      </Link>

      <div className="appnav-in">
        {MOBILE.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isActive(item) ? "page" : undefined}>
            <Svg path={item.icon} />
            {item.label}
          </Link>
        ))}
      </div>

      <div className="appnav-groups">
        {GROUPS.map((group) => (
          <div key={group.label} className="appnav-group" role="group" aria-label={group.label}>
            <p className="appnav-label" aria-hidden>
              {group.label}
            </p>
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isActive(item) ? "page" : undefined}>
                <Svg path={item.icon} />
                {item.label}
                {item.href === "/app/revisao" && dueReviews > 0 && (
                  <span className="appnav-count" aria-label={`${dueReviews} para revisar`}>
                    {dueReviews > 99 ? "99+" : dueReviews}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="appnav-foot">
        {FOOT.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isActive(item) ? "page" : undefined}>
            <Svg path={item.icon} />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
