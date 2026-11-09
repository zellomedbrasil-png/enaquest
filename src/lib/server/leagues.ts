import "server-only";
import { randomBytes } from "node:crypto";
import { admin } from "@/lib/supabase/admin";
import { AppError, enforceRateLimit } from "./session";

export const LEAGUE_NAMES = ["Bronze", "Prata", "Ouro", "Platina", "Diamante", "Mestre", "Grão-Mestre"];

export async function currentWeek(): Promise<string> {
  const { data, error } = await admin().rpc("week_start_br");
  if (error) throw error;
  return data;
}

export type BoardRow = { nickname: string; xp: number; me: boolean; position: number };

export type LeagueView = {
  week: string;
  tier: number;
  tierName: string;
  member: boolean;
  table: BoardRow[];
  promoteUntil: number;
  demoteFrom: number | null;
  schools: { name: string; uf: string | null; activeMembers: number; avgXp: number; mine: boolean }[];
  groups: { id: string; name: string; code: string; table: BoardRow[] }[];
};

export async function getLeagueView(userId: string): Promise<LeagueView> {
  const db = admin();
  const week = await currentWeek();
  const { data: profile } = await db.from("profiles").select("league_tier, school_id").eq("id", userId).single();
  const { data: me } = await db.from("league_members").select("tier, group_no").eq("week_start", week).eq("user_id", userId).maybeSingle();

  let table: BoardRow[] = [];
  if (me) {
    const { data } = await db.rpc("league_table", { p_week: week, p_tier: me.tier, p_group: me.group_no });
    table = ((data ?? []) as { user_id: string; nickname: string; xp: number }[]).map((row, i) => ({
      nickname: row.nickname,
      xp: row.xp,
      me: row.user_id === userId,
      position: i + 1,
    }));
  }

  const { data: schools } = await db.rpc("school_ranking", { p_week: week });
  const { data: memberships } = await db.from("group_members").select("groups(id, name, code)").eq("user_id", userId);
  const groups = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((memberships ?? []) as any[]).map(async ({ groups: group }) => {
      const { data } = await db.rpc("group_table", { p_group: group.id, p_week: week });
      return {
        id: group.id,
        name: group.name,
        code: group.code,
        table: ((data ?? []) as { user_id: string; nickname: string; xp: number }[]).map((row, i) => ({
          nickname: row.nickname,
          xp: row.xp,
          me: row.user_id === userId,
          position: i + 1,
        })),
      };
    }),
  );

  const tier = me?.tier ?? profile.league_tier;
  return {
    week,
    tier,
    tierName: LEAGUE_NAMES[tier] ?? "Bronze",
    member: Boolean(me),
    table,
    promoteUntil: table.length >= 10 ? 5 : 0,
    demoteFrom: table.length >= 10 ? table.length - 4 : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schools: ((schools ?? []) as any[]).map((row) => ({
      name: row.school_name,
      uf: row.uf,
      activeMembers: Number(row.active_members),
      avgXp: Number(row.avg_xp),
      mine: row.school_id === profile.school_id,
    })),
    groups,
  };
}

export async function createGroup(userId: string, name: string) {
  const clean = name.trim();
  if (clean.length < 3 || clean.length > 40) throw new AppError("invalid", "O nome da turma precisa ter entre 3 e 40 caracteres.");
  await enforceRateLimit(`group:${userId}`, 5, 86400);
  const db = admin();
  const code = randomBytes(4).toString("hex").toUpperCase();
  const { data, error } = await db.from("groups").insert({ name: clean, code, owner_id: userId }).select("id").single();
  if (error) throw error;
  await db.from("group_members").insert({ group_id: data.id, user_id: userId });
  return code;
}

export async function joinGroup(userId: string, code: string) {
  await enforceRateLimit(`joingroup:${userId}`, 20, 3600);
  const db = admin();
  const { data: group } = await db.from("groups").select("id").eq("code", code.trim().toUpperCase()).maybeSingle();
  if (!group) throw new AppError("not_found", "Código de turma não encontrado.");
  await db.from("group_members").upsert({ group_id: group.id, user_id: userId }, { ignoreDuplicates: true });
}

export async function leaveGroup(userId: string, groupId: string) {
  await admin().from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
}

/** Vira a liga da semana anterior. Chamada pelo agendador. */
export async function rolloverPreviousWeek(): Promise<number> {
  const db = admin();
  const week = await currentWeek();
  const previous = new Date(`${week}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 7);
  const { data, error } = await db.rpc("rollover_leagues", { p_week: previous.toISOString().slice(0, 10) });
  if (error) throw error;
  return data;
}
