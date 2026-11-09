import { describe, expect, it } from "vitest";
import { balance, CATALOG, cleanName, DEFAULT_LOOK, findItem, itemStatus, ownedItems, sanitizeLook, SLOTS, withItem, type MeritStats } from "./shop";

const novato: MeritStats = { bestStreak: 0, levelIndex: 0 };

describe("catálogo", () => {
  it("tem ids únicos e preços válidos", () => {
    expect(new Set(CATALOG.map((i) => i.id)).size).toBe(CATALOG.length);
    for (const item of CATALOG) {
      expect(Number.isInteger(item.price) && item.price >= 0, item.id).toBe(true);
      if (item.merit) expect(item.price, item.id).toBe(0);
    }
  });
  it("tem pelo menos um item em cada lugar e um grátis nos obrigatórios", () => {
    for (const slot of SLOTS) expect(CATALOG.some((i) => i.slot === slot), slot).toBe(true);
    for (const slot of ["character", "body", "background"] as const) {
      expect(CATALOG.some((i) => i.slot === slot && i.price === 0 && !i.merit), slot).toBe(true);
    }
  });
  it("o visual padrão usa só itens grátis do lugar certo", () => {
    const owned = ownedItems([], novato);
    expect(sanitizeLook(DEFAULT_LOOK, owned)).toEqual(DEFAULT_LOOK);
  });
  it("a coroa pede um nível que existe", () => {
    expect(findItem("coroa")!.merit!.goal).toBeGreaterThan(0);
  });
});

describe("saldo", () => {
  it("é o XP ganho menos o gasto, nunca negativo", () => {
    expect(balance(1000, 300)).toBe(700);
    expect(balance(100, 100)).toBe(0);
    expect(balance(100, 500)).toBe(0);
  });
});

describe("posse e compra", () => {
  it("novato tem só os itens grátis", () => {
    const owned = ownedItems([], novato);
    expect([...owned].sort()).toEqual(["doc", "enfermaria", "esteto", "jaleco"]);
  });
  it("item comprado passa a ser dele; id desconhecido é ignorado", () => {
    const owned = ownedItems(["touca", "nao_existe"], novato);
    expect(owned.has("touca")).toBe(true);
    expect(owned.has("nao_existe")).toBe(false);
  });
  it("item de mérito não se compra: só libera pela meta", () => {
    expect(ownedItems(["esteto_ouro"], novato).has("esteto_ouro")).toBe(false);
    expect(ownedItems([], { bestStreak: 30, levelIndex: 0 }).has("esteto_ouro")).toBe(true);
    expect(ownedItems([], { bestStreak: 0, levelIndex: 6 }).has("coroa")).toBe(true);
  });
  it("diz o estado de cada item", () => {
    const owned = ownedItems([], novato);
    expect(itemStatus(findItem("jaleco")!, owned, 0)).toBe("owned");
    expect(itemStatus(findItem("touca")!, owned, 200)).toBe("can_buy");
    expect(itemStatus(findItem("touca")!, owned, 199)).toBe("insufficient");
    expect(itemStatus(findItem("coroa")!, owned, 99999)).toBe("merit_locked");
  });
});

describe("visual", () => {
  const owned = ownedItems(["touca", "ps"], novato);

  it("troca o que a pessoa não tem pelo padrão", () => {
    const look = sanitizeLook({ character: "cirurgia", body: "samu", head: "touca", accessory: "martelo", background: "ps" }, owned);
    expect(look).toEqual({ character: "doc", body: "jaleco", head: "touca", accessory: null, background: "ps" });
  });
  it("recusa item no lugar errado e valores estranhos", () => {
    const look = sanitizeLook({ head: "jaleco", body: 42, background: null }, owned);
    expect(look.head).toBeNull();
    expect(look.body).toBe("jaleco");
    expect(look.background).toBe("enfermaria");
  });
  it("aceita ficar sem nada na cabeça e sem acessório", () => {
    const look = sanitizeLook({ head: null, accessory: null }, owned);
    expect(look.head).toBeNull();
    expect(look.accessory).toBeNull();
  });
  it("visual vazio vira o padrão", () => {
    expect(sanitizeLook(null, owned)).toEqual(DEFAULT_LOOK);
    expect(sanitizeLook({}, owned)).toEqual(DEFAULT_LOOK);
  });
  it("veste e tira peças só onde pode", () => {
    expect(withItem(DEFAULT_LOOK, "head", "touca").head).toBe("touca");
    expect(withItem(DEFAULT_LOOK, "accessory", null).accessory).toBeNull();
    expect(withItem(DEFAULT_LOOK, "body", null).body).toBe("jaleco");
    expect(withItem(DEFAULT_LOOK, "head", "jaleco").head).toBeNull();
  });
});

describe("nome do mascote", () => {
  it("aceita nomes comuns e limpa espaços", () => {
    expect(cleanName("  Dr.  Zé  ")).toBe("Dr. Zé");
    expect(cleanName("Ana-Lu")).toBe("Ana-Lu");
  });
  it("recusa curto, longo e com símbolos", () => {
    expect(cleanName("A")).toBeNull();
    expect(cleanName("a".repeat(17))).toBeNull();
    expect(cleanName("<b>oi</b>")).toBeNull();
  });
});
