import "server-only";
import { cache } from "react";
import { admin } from "@/lib/supabase/admin";
import {
  balance,
  cleanName,
  DEFAULT_NAME,
  findItem,
  NAME_MAX,
  NAME_MIN,
  ownedItems,
  sanitizeLook,
  type Look,
  type MeritStats,
} from "@/lib/game/shop";
import { levelOf } from "@/lib/game/xp";
import { AppError, enforceRateLimit } from "./session";

export type MascotView = {
  name: string;
  look: Look;
  /** Tudo o que pode ser vestido agora: grátis, comprado e mérito liberado. */
  owned: string[];
  xpTotal: number;
  xpSpent: number;
  balance: number;
  merit: MeritStats;
};

export async function getMascot(userId: string): Promise<MascotView> {
  const db = admin();
  const [{ data: state }, { data: items }, { data: rating }, { data: streak }] = await Promise.all([
    db.from("mascot_state").select("character, equipped, name").eq("user_id", userId).maybeSingle(),
    db.from("mascot_items").select("item_id").eq("user_id", userId),
    db.from("rating_state").select("xp_total, xp_spent").eq("user_id", userId).single(),
    db.from("streaks").select("best").eq("user_id", userId).single(),
  ]);
  const merit: MeritStats = { bestStreak: streak?.best ?? 0, levelIndex: levelOf(rating.xp_total).index };
  const owned = ownedItems((items ?? []).map((row: { item_id: string }) => row.item_id), merit);
  // Sem linha ainda: a pessoa nunca mexeu no mascote e usa o visual padrão.
  const look = sanitizeLook(state ? { ...(state.equipped as Record<string, unknown>), character: state.character } : null, owned);
  return {
    name: state?.name ?? DEFAULT_NAME,
    look,
    owned: [...owned],
    xpTotal: rating.xp_total,
    xpSpent: rating.xp_spent,
    balance: balance(rating.xp_total, rating.xp_spent),
    merit,
  };
}

async function saveLook(userId: string, look: Look) {
  const { character, ...equipped } = look;
  const { error } = await admin()
    .from("mascot_state")
    .upsert({ user_id: userId, character, equipped, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Veste o visual pedido. O que a pessoa não possui volta para o padrão. */
export async function equip(userId: string, wanted: Partial<Record<string, unknown>>): Promise<MascotView> {
  await enforceRateLimit(`mascot-equip:${userId}`, 60, 60);
  const current = await getMascot(userId);
  const look = sanitizeLook(wanted, new Set(current.owned));
  await saveLook(userId, look);
  return { ...current, look };
}

/** Troca XP por um item. O preço vem sempre do catálogo, nunca do navegador. */
export async function buyItem(userId: string, itemId: string): Promise<MascotView> {
  await enforceRateLimit(`mascot-buy:${userId}`, 20, 60);
  const item = findItem(itemId);
  if (!item) throw new AppError("not_found", "Esse item não existe na lojinha.");
  if (item.merit) throw new AppError("invalid", `Esse item não se compra. ${item.merit.text} para liberar.`);
  if (item.price <= 0) throw new AppError("invalid", "Esse item já é seu.");

  const { data, error } = await admin().rpc("buy_mascot_item", { p_user: userId, p_item: item.id, p_price: item.price });
  if (error) throw error;
  if (data === "owned") throw new AppError("invalid", "Você já tem esse item.");
  if (data === "insufficient") throw new AppError("invalid", "Seu saldo de XP não é suficiente para esse item.");
  if (data !== "ok") throw new AppError("invalid", "Não foi possível concluir a troca.");

  // Compra feita: o item já entra no visual.
  const after = await getMascot(userId);
  const look = sanitizeLook({ ...after.look, [item.slot]: item.id }, new Set(after.owned));
  await saveLook(userId, look);
  return { ...after, look };
}

export async function renameMascot(userId: string, raw: string): Promise<string> {
  await enforceRateLimit(`mascot-name:${userId}`, 10, 60);
  const name = cleanName(raw);
  if (!name) throw new AppError("invalid", `O nome precisa ter de ${NAME_MIN} a ${NAME_MAX} caracteres, só com letras e números.`);
  const { error } = await admin().from("mascot_state").upsert({ user_id: userId, name, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
  return name;
}

/** Para páginas: uma leitura por requisição. Ações usam getMascot, que sempre lê de novo. */
export const getMascotForPage = cache(getMascot);
