import "server-only";
import type { User } from "@supabase/supabase-js";
import { admin } from "@/lib/supabase/admin";
import { saveStudyGoals, type StudyGoals } from "./day-plan";
import { AppError, enforceRateLimit } from "./session";

/** Apelido que o cadastro cria sozinho antes de a pessoa escolher um. */
export const AUTO_NICKNAME = /^plantonista_/;
const NICKNAME = /^[\p{L}\p{N}_.-]{3,24}$/u;

/** Primeiro nome que o Google mandou, para cumprimentar a pessoa. */
export function firstNameOf(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const full = [meta.given_name, meta.full_name, meta.name].find((value) => typeof value === "string" && value.trim());
  const first = typeof full === "string" ? full.trim().split(/\s+/)[0] : "";
  return first.length >= 2 ? first : null;
}

/** Sugere um apelido a partir do primeiro nome, só enquanto a pessoa ainda tem o apelido automático. */
export async function suggestNickname(current: string, firstName: string | null): Promise<string> {
  if (!AUTO_NICKNAME.test(current) || !firstName) return current;
  const base = firstName.replace(/[^\p{L}\p{N}_.-]/gu, "").slice(0, 18);
  if (base.length < 3) return current;
  const candidates = [base, ...Array.from({ length: 3 }, () => `${base}_${Math.floor(10 + Math.random() * 990)}`)];
  for (const candidate of candidates) {
    const { count } = await admin().from("profiles").select("id", { count: "exact", head: true }).eq("nickname", candidate);
    if ((count ?? 0) === 0) return candidate;
  }
  return current;
}

export type OnboardingInput = StudyGoals & { nickname: string; schoolId: string | null; showSchool: boolean };

/** Grava o perfil e as metas escolhidas no onboarding. O apelido vem primeiro: se já existir, nada é salvo. */
export async function completeOnboarding(userId: string, input: OnboardingInput): Promise<void> {
  await enforceRateLimit(`onboarding:${userId}`, 20, 3600);
  const nickname = input.nickname.trim();
  if (!NICKNAME.test(nickname)) throw new AppError("invalid", "O apelido precisa ter de 3 a 24 caracteres, sem espaços.");
  const { error } = await admin()
    .from("profiles")
    .update({ nickname, school_id: input.schoolId, show_school: input.schoolId ? input.showSchool : false })
    .eq("id", userId);
  if (error?.code === "23505") throw new AppError("invalid", "Esse apelido já está em uso. Escolha outro.");
  if (error) throw error;
  await saveStudyGoals(userId, { minutes: input.minutes, targetExam: input.targetExam, examDate: input.examDate });
}
