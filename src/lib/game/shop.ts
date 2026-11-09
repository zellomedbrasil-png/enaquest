// Lojinha do mascote: catálogo e regras. Tudo aqui é cosmético e função pura.
// Gastar XP não mexe no nível nem na liga: a loja usa o saldo (XP ganho menos XP gasto).

import { LEVELS } from "./xp";

export type Slot = "character" | "body" | "head" | "accessory" | "background";

export const SLOT_LABEL: Record<Slot, string> = {
  character: "Mascotes",
  body: "Roupas",
  head: "Cabeça",
  accessory: "Acessórios",
  background: "Fundos",
};

export const SLOTS: Slot[] = ["character", "body", "head", "accessory", "background"];

/** Item de mérito: não se compra, libera ao atingir a meta. */
export type Merit = { kind: "streak" | "level"; goal: number; text: string };

export type ShopItem = {
  id: string;
  slot: Slot;
  name: string;
  description: string;
  /** 0 para itens grátis e de mérito. */
  price: number;
  merit?: Merit;
};

const PRECEPTOR = LEVELS.findIndex((level) => level.name === "Preceptor");

export const CATALOG: ShopItem[] = [
  // Mascotes
  { id: "doc", slot: "character", name: "Doc", description: "Clínico de plantão. Já vem com você.", price: 0 },
  { id: "cirurgia", slot: "character", name: "Dra. Sutura", description: "Cirurgiã de mão firme.", price: 1500 },
  { id: "pediatra", slot: "character", name: "Dr. Pingo", description: "Pediatra que acalma qualquer choro.", price: 2000 },
  { id: "socorrista", slot: "character", name: "Dra. Sirene", description: "Socorrista que chega primeiro.", price: 2500 },

  // Roupas
  { id: "jaleco", slot: "body", name: "Jaleco", description: "O clássico branco.", price: 0 },
  { id: "pijama_verde", slot: "body", name: "Pijama cirúrgico verde", description: "Para o centro cirúrgico.", price: 400 },
  { id: "pijama_azul", slot: "body", name: "Pijama cirúrgico azul", description: "O azul da enfermaria.", price: 400 },
  { id: "avental", slot: "body", name: "Avental de centro cirúrgico", description: "Estéril da gola ao joelho.", price: 700 },
  { id: "samu", slot: "body", name: "Colete do SAMU", description: "Laranja de quem atende na rua.", price: 900 },

  // Cabeça
  { id: "touca", slot: "head", name: "Touca cirúrgica", description: "Cabelo preso, campo limpo.", price: 200 },
  { id: "espelho", slot: "head", name: "Espelho frontal", description: "O refletor dos consultórios antigos.", price: 350 },
  { id: "gorro", slot: "head", name: "Gorro estampado", description: "Cheio de bolinhas.", price: 500 },
  {
    id: "coroa",
    slot: "head",
    name: "Coroa de Preceptor",
    description: "Só para quem chegou ao topo.",
    price: 0,
    merit: { kind: "level", goal: PRECEPTOR, text: "Chegue ao nível Preceptor" },
  },

  // Acessórios
  { id: "esteto", slot: "accessory", name: "Estetoscópio", description: "No pescoço, como deve ser.", price: 0 },
  { id: "prancheta", slot: "accessory", name: "Prancheta", description: "Evolução em dia.", price: 150 },
  { id: "cafe", slot: "accessory", name: "Café de plantão", description: "O combustível da madrugada.", price: 250 },
  { id: "martelo", slot: "accessory", name: "Martelo de reflexo", description: "Para o exame neurológico.", price: 400 },
  {
    id: "esteto_ouro",
    slot: "accessory",
    name: "Estetoscópio dourado",
    description: "Prêmio de constância.",
    price: 0,
    merit: { kind: "streak", goal: 30, text: "Mantenha 30 dias de sequência" },
  },

  // Fundos
  { id: "enfermaria", slot: "background", name: "Enfermaria", description: "Onde tudo começa.", price: 0 },
  { id: "ps", slot: "background", name: "Pronto-socorro", description: "Luz vermelha e correria.", price: 300 },
  { id: "centro", slot: "background", name: "Centro cirúrgico", description: "Foco aceso.", price: 500 },
  { id: "noturno", slot: "background", name: "Plantão noturno", description: "Lua, estrelas e silêncio.", price: 700 },
];

const BY_ID = new Map(CATALOG.map((item) => [item.id, item]));

export function findItem(id: string): ShopItem | undefined {
  return BY_ID.get(id);
}

export type Look = {
  character: string;
  body: string;
  head: string | null;
  accessory: string | null;
  background: string;
};

export const DEFAULT_LOOK: Look = { character: "doc", body: "jaleco", head: null, accessory: "esteto", background: "enfermaria" };

/** Cabeça e acessório podem ficar vazios; os outros sempre têm algo. */
export const OPTIONAL_SLOTS: Slot[] = ["head", "accessory"];

/** XP disponível para gastar. Nunca negativo. */
export function balance(xpTotal: number, xpSpent: number): number {
  return Math.max(0, xpTotal - xpSpent);
}

export type MeritStats = { bestStreak: number; levelIndex: number };

export function meritUnlocked(merit: Merit, stats: MeritStats): boolean {
  return merit.kind === "streak" ? stats.bestStreak >= merit.goal : stats.levelIndex >= merit.goal;
}

/** Tudo o que a pessoa pode vestir: grátis, comprado e mérito já atingido. */
export function ownedItems(purchased: Iterable<string>, stats: MeritStats): Set<string> {
  const owned = new Set<string>();
  const bought = new Set(purchased);
  for (const item of CATALOG) {
    if (item.merit) {
      if (meritUnlocked(item.merit, stats)) owned.add(item.id);
    } else if (item.price === 0 || bought.has(item.id)) {
      owned.add(item.id);
    }
  }
  return owned;
}

export type ItemStatus = "owned" | "merit_locked" | "can_buy" | "insufficient";

export function itemStatus(item: ShopItem, owned: Set<string>, available: number): ItemStatus {
  if (owned.has(item.id)) return "owned";
  if (item.merit) return "merit_locked";
  return available >= item.price ? "can_buy" : "insufficient";
}

/** Garante um visual válido: um item por lugar, do lugar certo e que a pessoa possui. */
export function sanitizeLook(input: Partial<Record<Slot, unknown>> | null | undefined, owned: Set<string>): Look {
  const pick = (slot: Slot): string | null => {
    const value = input?.[slot];
    if (typeof value !== "string") return null;
    const item = BY_ID.get(value);
    return item && item.slot === slot && owned.has(value) ? value : null;
  };
  const has = (slot: Slot) => input != null && slot in input;
  return {
    character: pick("character") ?? DEFAULT_LOOK.character,
    body: pick("body") ?? DEFAULT_LOOK.body,
    // Vazio é uma escolha válida; só cai no padrão quando nada foi informado.
    head: has("head") ? pick("head") : DEFAULT_LOOK.head,
    accessory: has("accessory") ? pick("accessory") : DEFAULT_LOOK.accessory,
    background: pick("background") ?? DEFAULT_LOOK.background,
  };
}

/** Visual com um item trocado, para vestir ou provar. Tirar só vale em lugar opcional. */
export function withItem(look: Look, slot: Slot, id: string | null): Look {
  if (id === null) return OPTIONAL_SLOTS.includes(slot) ? { ...look, [slot]: null } : look;
  const item = BY_ID.get(id);
  return item && item.slot === slot ? { ...look, [slot]: id } : look;
}

export const NAME_MIN = 2;
export const NAME_MAX = 16;
export const DEFAULT_NAME = "Doc";

/** Nome do mascote: letras, números, espaço, ponto e hífen. */
export function cleanName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null;
  return /^[\p{L}\p{N} .'-]+$/u.test(name) ? name : null;
}
