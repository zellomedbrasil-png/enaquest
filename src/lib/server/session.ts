import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { hasPremiumAccess, type Entitlement } from "@/lib/billing/access";

export const currentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  return user;
}

export const getEntitlement = cache(async (userId: string): Promise<Entitlement | null> => {
  const { data } = await admin().from("entitlements").select("plan, access_until, payment_problem").eq("user_id", userId).single();
  return data;
});

export async function isPremium(userId: string): Promise<boolean> {
  return hasPremiumAccess(await getEntitlement(userId));
}

export const getProfile = cache(async (userId: string) => {
  const { data } = await admin()
    .from("profiles")
    .select("id, nickname, school_id, show_school, role, league_tier, placement_done, created_at")
    .eq("id", userId)
    .single();
  return data as {
    id: string;
    nickname: string;
    school_id: string | null;
    show_school: boolean;
    role: "student" | "editor" | "admin";
    league_tier: number;
    placement_done: boolean;
    created_at: string;
  };
});

export async function requireEditor() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (profile.role !== "editor" && profile.role !== "admin") redirect("/app");
  return { user, profile };
}

export class AppError extends Error {
  constructor(
    public code: "premium_required" | "rate_limited" | "not_found" | "invalid" | "closed",
    message: string,
  ) {
    super(message);
  }
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const { data } = await admin().rpc("rate_limit_hit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (data === true) throw new AppError("rate_limited", "Muitas requisições em pouco tempo. Aguarde um instante.");
}
