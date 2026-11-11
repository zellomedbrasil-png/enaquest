import "server-only";
import { cache } from "react";
import { findMascot, resolveMascot, type MascotId } from "@/lib/game/mascots";
import { admin } from "@/lib/supabase/admin";
import { AppError, enforceRateLimit } from "./session";

export type MascotView = { character: MascotId; name: string };

export async function getMascot(userId: string): Promise<MascotView> {
  const { data, error } = await admin().from("mascot_state").select("character").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  const mascot = resolveMascot(data?.character);
  return { character: mascot.id, name: mascot.name };
}

export async function selectMascot(userId: string, character: string): Promise<MascotView> {
  const mascot = findMascot(character);
  if (!mascot) throw new AppError("invalid", "Escolha um dos mascotes disponíveis.");
  await enforceRateLimit(`mascot-select:${userId}`, 60, 60);
  const { error } = await admin().from("mascot_state").upsert({
    user_id: userId,
    character: mascot.id,
    name: mascot.name,
    equipped: {},
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
  return { character: mascot.id, name: mascot.name };
}

export const getMascotForPage = cache(getMascot);
