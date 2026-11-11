// Companheiros de jornada. Cada um tem um jeito de estudar: a frase, os traços e a cor
// aparecem na aba Mascote. São só personalidade, não mudam regras do jogo.
export const MASCOTS = [
  {
    id: "luisa",
    name: "Dra. Luísa",
    image: "/mascotes/companheiros/luisa.webp",
    tagline: "Calma no meio da tempestade",
    traits: ["Emergência", "Foco"],
    quote: "Respira e lê o enunciado até o fim. A pista está lá.",
    accent: "#ff7eb6",
  },
  {
    id: "roberto",
    name: "Dr. Roberto",
    image: "/mascotes/companheiros/roberto.webp",
    tagline: "Estrategista do plantão",
    traits: ["Clínica", "Raciocínio"],
    quote: "Hipótese primeiro, alternativa depois.",
    accent: "#5bc0ff",
  },
  {
    id: "davi",
    name: "Dr. Davi",
    image: "/mascotes/companheiros/davi.webp",
    tagline: "Ritmo de maratonista",
    traits: ["Constância", "Sequência"],
    quote: "Um pouco todo dia vence qualquer cansaço.",
    accent: "#ff9f43",
  },
  {
    id: "helena",
    name: "Dra. Helena",
    image: "/mascotes/companheiros/helena.webp",
    tagline: "Mestre da revisão",
    traits: ["Revisão", "Memória"],
    quote: "Errou? Ótimo. Agora esse tema não escapa mais.",
    accent: "#b39dff",
  },
  {
    id: "marina",
    name: "Dra. Marina",
    image: "/mascotes/companheiros/marina.webp",
    tagline: "Olho clínico afiado",
    traits: ["Detalhes", "Exames"],
    quote: "O valor do exame muda tudo. Confere a referência.",
    accent: "#4dd6c1",
  },
  {
    id: "clara",
    name: "Dra. Clara",
    image: "/mascotes/companheiros/clara.webp",
    tagline: "Coração de pediatra",
    traits: ["Pediatria", "Cuidado"],
    quote: "Idade e peso primeiro, sempre.",
    accent: "#ffd84d",
  },
  {
    id: "felipe",
    name: "Dr. Felipe",
    image: "/mascotes/companheiros/felipe.webp",
    tagline: "Sangue frio no centro cirúrgico",
    traits: ["Cirurgia", "Decisão"],
    quote: "Estável ou instável? Começa por aí.",
    accent: "#ff5d73",
  },
  {
    id: "rafael",
    name: "Dr. Rafael",
    image: "/mascotes/companheiros/rafael.webp",
    tagline: "Defensor do SUS",
    traits: ["Saúde coletiva", "Prevenção"],
    quote: "Pensa na população, não só no paciente da frente.",
    accent: "#7ee8a2",
  },
] as const;

export type MascotId = (typeof MASCOTS)[number]["id"];
export type MascotProfile = (typeof MASCOTS)[number];
export const DEFAULT_MASCOT = MASCOTS[1];

export function findMascot(id: unknown) {
  return MASCOTS.find((mascot) => mascot.id === id);
}

/** Perfis com personagens da versão anterior recebem o companheiro padrão. */
export function resolveMascot(id: unknown) {
  return findMascot(id) ?? DEFAULT_MASCOT;
}
