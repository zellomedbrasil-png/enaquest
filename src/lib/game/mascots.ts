export const MASCOTS = [
  { id: "luisa", name: "Dra. Luísa", image: "/mascotes/companheiros/luisa.webp" },
  { id: "roberto", name: "Dr. Roberto", image: "/mascotes/companheiros/roberto.webp" },
  { id: "davi", name: "Dr. Davi", image: "/mascotes/companheiros/davi.webp" },
  { id: "helena", name: "Dra. Helena", image: "/mascotes/companheiros/helena.webp" },
  { id: "marina", name: "Dra. Marina", image: "/mascotes/companheiros/marina.webp" },
  { id: "clara", name: "Dra. Clara", image: "/mascotes/companheiros/clara.webp" },
  { id: "felipe", name: "Dr. Felipe", image: "/mascotes/companheiros/felipe.webp" },
  { id: "rafael", name: "Dr. Rafael", image: "/mascotes/companheiros/rafael.webp" },
] as const;

export type MascotId = (typeof MASCOTS)[number]["id"];
export const DEFAULT_MASCOT = MASCOTS[1];

export function findMascot(id: unknown) {
  return MASCOTS.find((mascot) => mascot.id === id);
}

/** Perfis com personagens da versão anterior recebem o companheiro padrão. */
export function resolveMascot(id: unknown) {
  return findMascot(id) ?? DEFAULT_MASCOT;
}
