import { beforeEach, describe, expect, it } from "vitest";
import { buyItem, equip, getMascot, renameMascot } from "@/lib/server/mascot";
import { DEFAULT_LOOK } from "@/lib/game/shop";
import { createUser, db } from "./helpers";

async function giveXp(userId: string, amount: number) {
  const { data } = await db().rpc("award_xp", { p_user: userId, p_amount: amount, p_kind: "teste", p_ref: `mascote-${Date.now()}-${Math.random()}` });
  expect(data).toBe(true);
}

async function totals(userId: string) {
  const { data } = await db().from("rating_state").select("xp_total, xp_spent").eq("user_id", userId).single();
  return data as { xp_total: number; xp_spent: number };
}

describe("lojinha do mascote", () => {
  let user: Awaited<ReturnType<typeof createUser>>;

  beforeEach(async () => {
    user = await createUser();
  });

  it("quem nunca mexeu vê o mascote padrão, sem linha no banco", async () => {
    const view = await getMascot(user.id);
    expect(view.look).toEqual(DEFAULT_LOOK);
    expect(view.name).toBe("Doc");
    expect(view.balance).toBe(0);
    expect(view.owned.sort()).toEqual(["doc", "enfermaria", "esteto", "jaleco"]);
  });

  it("troca XP por um item, veste e não mexe no XP ganho nem na liga", async () => {
    await giveXp(user.id, 500);
    const league = await db().from("league_members").select("xp").eq("user_id", user.id).single();

    const view = await buyItem(user.id, "touca");
    expect(view.balance).toBe(300);
    expect(view.look.head).toBe("touca");
    expect(view.owned).toContain("touca");

    expect(await totals(user.id)).toEqual({ xp_total: 500, xp_spent: 200 });
    const after = await db().from("league_members").select("xp").eq("user_id", user.id).single();
    expect(after.data.xp).toBe(league.data.xp);

    // O visual persiste.
    expect((await getMascot(user.id)).look.head).toBe("touca");
  });

  it("recusa quando o saldo não dá, sem debitar", async () => {
    await giveXp(user.id, 199);
    await expect(buyItem(user.id, "touca")).rejects.toThrow(/saldo/);
    expect(await totals(user.id)).toEqual({ xp_total: 199, xp_spent: 0 });
    expect((await db().from("mascot_items").select("*").eq("user_id", user.id)).data).toHaveLength(0);
  });

  it("não cobra duas vezes o mesmo item", async () => {
    await giveXp(user.id, 1000);
    await buyItem(user.id, "touca");
    await expect(buyItem(user.id, "touca")).rejects.toThrow(/já tem/);
    expect((await totals(user.id)).xp_spent).toBe(200);
  });

  it("duas compras ao mesmo tempo não gastam o mesmo XP", async () => {
    await giveXp(user.id, 450);
    // Touca (200) e espelho (350): juntos passam do saldo, então só um pode entrar.
    const results = await Promise.allSettled([buyItem(user.id, "touca"), buyItem(user.id, "espelho")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const { xp_total, xp_spent } = await totals(user.id);
    expect(xp_spent).toBeLessThanOrEqual(xp_total);
    expect((await db().from("mascot_items").select("*").eq("user_id", user.id)).data).toHaveLength(1);
  });

  it("item de mérito, item grátis e item inexistente não se compram", async () => {
    await giveXp(user.id, 5000);
    await expect(buyItem(user.id, "esteto_ouro")).rejects.toThrow(/não se compra/);
    await expect(buyItem(user.id, "jaleco")).rejects.toThrow(/já é seu/);
    await expect(buyItem(user.id, "item_inventado")).rejects.toThrow(/não existe/);
    expect((await totals(user.id)).xp_spent).toBe(0);
  });

  it("item de mérito libera pela sequência, sem compra", async () => {
    expect((await getMascot(user.id)).owned).not.toContain("esteto_ouro");
    await db().from("streaks").update({ best: 30 }).eq("user_id", user.id);
    expect((await getMascot(user.id)).owned).toContain("esteto_ouro");
  });

  it("vestir o que não possui volta para o padrão", async () => {
    const view = await equip(user.id, { character: "cirurgia", body: "samu", head: "coroa", accessory: null, background: "noturno" });
    expect(view.look).toEqual({ ...DEFAULT_LOOK, accessory: null });
    expect((await getMascot(user.id)).look).toEqual({ ...DEFAULT_LOOK, accessory: null });
  });

  it("comprar outro mascote troca o personagem e mantém a roupa", async () => {
    await giveXp(user.id, 2000);
    await buyItem(user.id, "touca");
    const view = await buyItem(user.id, "cirurgia");
    expect(view.look.character).toBe("cirurgia");
    expect(view.look.head).toBe("touca");
    expect(view.balance).toBe(300);
  });

  it("renomeia o mascote e recusa nome inválido", async () => {
    expect(await renameMascot(user.id, "  Dra.  Lia ")).toBe("Dra. Lia");
    expect((await getMascot(user.id)).name).toBe("Dra. Lia");
    await expect(renameMascot(user.id, "<script>")).rejects.toThrow(/nome/);
    await expect(renameMascot(user.id, "x")).rejects.toThrow(/nome/);
  });

  it("o banco não deixa gastar mais do que ganhou", async () => {
    await giveXp(user.id, 100);
    const { error } = await db().from("rating_state").update({ xp_spent: 101 }).eq("user_id", user.id);
    expect(error).not.toBeNull();
  });

  it("o navegador não compra, não se dá item e não zera o gasto", async () => {
    await giveXp(user.id, 1000);
    await buyItem(user.id, "touca");

    const rpc = await user.client.rpc("buy_mascot_item", { p_user: user.id, p_item: "gorro", p_price: 1 });
    expect(rpc.error).not.toBeNull();
    await user.client.from("mascot_items").insert({ user_id: user.id, item_id: "cirurgia", price: 1 });
    await user.client.from("rating_state").update({ xp_spent: 0 }).eq("user_id", user.id);
    await user.client.from("mascot_state").upsert({ user_id: user.id, character: "cirurgia" });

    const items = await db().from("mascot_items").select("item_id").eq("user_id", user.id);
    expect(items.data!.map((i: { item_id: string }) => i.item_id)).toEqual(["touca"]);
    expect((await totals(user.id)).xp_spent).toBe(200);
    expect((await getMascot(user.id)).look.character).toBe("doc");
  });

  it("cada um lê só os próprios itens", async () => {
    await giveXp(user.id, 500);
    await buyItem(user.id, "touca");
    const other = await createUser();
    expect((await other.client.from("mascot_items").select("*")).data).toHaveLength(0);
    expect((await user.client.from("mascot_items").select("*")).data).toHaveLength(1);
  });

  it("excluir a conta apaga itens e mascote", async () => {
    await giveXp(user.id, 500);
    await buyItem(user.id, "touca");
    await db().auth.admin.deleteUser(user.id);
    expect((await db().from("mascot_items").select("*").eq("user_id", user.id)).data).toHaveLength(0);
    expect((await db().from("mascot_state").select("*").eq("user_id", user.id)).data).toHaveLength(0);
  });
});
