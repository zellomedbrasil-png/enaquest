import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMascot, selectMascot } from "@/lib/server/mascot";
import { DEFAULT_MASCOT, MASCOTS } from "@/lib/game/mascots";
import { createUser, db } from "./helpers";

describe("escolha do mascote", () => {
  let user: Awaited<ReturnType<typeof createUser>>;
  const users: string[] = [];

  beforeEach(async () => {
    user = await createUser();
    users.push(user.id);
  });

  afterEach(async () => {
    for (const id of users.splice(0)) await db().auth.admin.deleteUser(id);
  });

  it("usa o personagem padrão quando ainda não existe escolha", async () => {
    expect(await getMascot(user.id)).toEqual({ character: DEFAULT_MASCOT.id, name: DEFAULT_MASCOT.name });
  });

  it("permite escolher todos os oito personagens sem saldo de XP", async () => {
    const before = await db().from("rating_state").select("xp_total, xp_spent").eq("user_id", user.id).single();
    for (const mascot of MASCOTS) {
      const selected = { character: mascot.id, name: mascot.name };
      expect(await selectMascot(user.id, mascot.id)).toEqual(selected);
      expect(await getMascot(user.id)).toEqual(selected);
    }
    const after = await db().from("rating_state").select("xp_total, xp_spent").eq("user_id", user.id).single();
    expect(after.data).toEqual(before.data);
    expect((await db().from("mascot_items").select("*").eq("user_id", user.id)).data).toHaveLength(0);
  });

  it("resolve o visual antigo e usa o nome fixo do novo personagem", async () => {
    await db().from("mascot_state").insert({ user_id: user.id, character: "cirurgia", name: "Meu apelido", equipped: { head: "touca" } });
    expect((await getMascot(user.id)).character).toBe(DEFAULT_MASCOT.id);
    await selectMascot(user.id, "luisa");
    const saved = await db().from("mascot_state").select("character, name, equipped").eq("user_id", user.id).single();
    expect(saved.data).toEqual({ character: "luisa", name: "Dra. Luísa", equipped: {} });
  });

  it("recusa personagens desconhecidos sem perder a escolha anterior", async () => {
    await selectMascot(user.id, "rafael");
    await expect(selectMascot(user.id, "inventado")).rejects.toThrow(/disponíveis/);
    expect((await getMascot(user.id)).character).toBe("rafael");
  });

  it("isola a escolha entre contas e impede escrita direta pelo navegador", async () => {
    await selectMascot(user.id, "helena");
    const other = await createUser();
    users.push(other.id);
    expect((await getMascot(other.id)).character).toBe(DEFAULT_MASCOT.id);
    expect((await other.client.from("mascot_state").select("*")).data).toHaveLength(0);
    await other.client.from("mascot_state").upsert({ user_id: user.id, character: "felipe" });
    expect((await getMascot(user.id)).character).toBe("helena");
  });
});
