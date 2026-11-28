"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { safePath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";
import { AppError, getProfile, requireEditor, requireUser } from "@/lib/server/session";
import { todayMissions } from "@/lib/server/progress";
import * as mascot from "@/lib/server/mascot";
import { setErrorReason, submitAnswer, type AnswerResult, type ErrorReason } from "@/lib/server/answers";
import {
  getDueReviews,
  getRevealForAnswered,
  getStudyState,
  rateQuestion,
  setQuestionMark,
  startTraining,
  type TrainingFilter,
} from "@/lib/server/study";
import { finishSimulado, saveSimuladoProgress } from "@/lib/server/simulados";
import { ensureOfficialSimulado, startOfficialRound } from "@/lib/server/official";
import * as community from "@/lib/server/community";
import * as leagues from "@/lib/server/leagues";
import * as editorial from "@/lib/server/editorial";
import { createCheckoutSession, createPortalUrl, withdrawSubscription } from "@/lib/billing/subscriptions";
import { stripeConfigured } from "@/lib/billing/stripe";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, code: error.code, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, code: "invalid", message: "Dados inválidos." };
    // redirect() e afins do Next precisam continuar subindo.
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error(error);
    return { ok: false, code: "error", message: "Algo deu errado. Tente de novo." };
  }
}

// ---------- Autenticação (só Google) ----------
export type AuthState = { error?: string; notice?: string };

export async function signInWithGoogle(form: FormData) {
  const next = encodeURIComponent(safePath(form.get("next")));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${next}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) {
    console.error("[auth] entrar com Google", { code: error.code, status: error.status, message: error.message });
    redirect("/entrar?erro=google");
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------- Questões ----------
const answerSchema = z.object({
  questionId: z.uuid(),
  mode: z.enum(["daily", "training", "review"]),
  context: z.string().min(1).max(64),
  selected: z.number().int().min(0).max(4),
  confidence: z.enum(["certeza", "duvida", "chute"]).nullable().optional(),
  ms: z.number().int().min(0).max(3_600_000).nullable().optional(),
});

export async function answerAction(input: z.input<typeof answerSchema>): Promise<ActionResult<AnswerResult>> {
  return run(async () => {
    const user = await requireUser();
    return submitAnswer(user.id, answerSchema.parse(input));
  });
}

export async function todayMissionsAction() {
  return run(async () => {
    const user = await requireUser();
    return todayMissions(user.id);
  });
}

// ---------- Mascote ----------
export async function selectMascotAction(character: string) {
  return run(async () => {
    const user = await requireUser();
    const view = await mascot.selectMascot(user.id, z.string().min(1).max(40).parse(character));
    revalidatePath("/app", "layout");
    return view;
  });
}

export async function errorReasonAction(answerId: string, reason: ErrorReason) {
  return run(async () => {
    const user = await requireUser();
    await setErrorReason(user.id, z.uuid().parse(answerId), reason);
  });
}

export async function rateQuestionAction(questionId: string, vote: -1 | 0 | 1) {
  return run(async () => {
    const user = await requireUser();
    await rateQuestion(user.id, z.uuid().parse(questionId), z.union([z.literal(-1), z.literal(0), z.literal(1)]).parse(vote));
  });
}

export async function markQuestionAction(questionId: string, marked: boolean) {
  return run(async () => {
    const user = await requireUser();
    await setQuestionMark(user.id, z.uuid().parse(questionId), z.boolean().parse(marked));
  });
}

export async function studyStateAction(questionIds: string[]) {
  return run(async () => {
    const user = await requireUser();
    return getStudyState(user.id, z.array(z.uuid()).max(60).parse(questionIds));
  });
}

export async function revealAction(questionId: string) {
  return run(async () => {
    const user = await requireUser();
    return getRevealForAnswered(user.id, z.uuid().parse(questionId));
  });
}

export async function startTrainingAction(input: { areaId: string | null; filter: TrainingFilter; size: number }) {
  return run(async () => {
    const user = await requireUser();
    return startTraining(user.id, input);
  });
}

export async function startOfficialRoundAction(examId: string, size: number) {
  return run(async () => {
    const user = await requireUser();
    return startOfficialRound(user.id, z.string().min(1).max(80).parse(examId), z.number().int().min(5).max(100).parse(size));
  });
}

export async function startOfficialSimuladoAction(examId: string) {
  return run(async () => {
    const user = await requireUser();
    return { simuladoId: await ensureOfficialSimulado(user.id, z.string().min(1).max(80).parse(examId)) };
  });
}

export async function startReviewAction() {
  return run(async () => {
    const user = await requireUser();
    return getDueReviews(user.id);
  });
}

// ---------- Simulado ----------
export async function saveSimuladoAction(attemptId: string, progress: { answers: Record<string, number>; flags: string[] }) {
  return run(async () => {
    const user = await requireUser();
    await saveSimuladoProgress(user.id, z.uuid().parse(attemptId), progress);
  });
}

export async function finishSimuladoAction(attemptId: string, progress: { answers: Record<string, number>; flags: string[] }) {
  return run(async () => {
    const user = await requireUser();
    const id = z.uuid().parse(attemptId);
    await saveSimuladoProgress(user.id, id, progress).catch((error) => {
      if (!(error instanceof AppError && error.code === "closed")) throw error;
    });
    await finishSimulado(user.id, id);
  });
}

// ---------- Comunidade ----------
export async function listCommentsAction(questionId: string) {
  return run(async () => {
    const user = await requireUser();
    return community.listComments(user.id, z.uuid().parse(questionId));
  });
}

export async function addCommentAction(questionId: string, body: string) {
  return run(async () => {
    const user = await requireUser();
    await community.addComment(user.id, z.uuid().parse(questionId), body);
  });
}

export async function voteCommentAction(commentId: string) {
  return run(async () => {
    const user = await requireUser();
    return community.voteComment(user.id, z.uuid().parse(commentId));
  });
}

export async function reportCommentAction(commentId: string) {
  return run(async () => {
    const user = await requireUser();
    await community.reportComment(user.id, z.uuid().parse(commentId));
  });
}

export async function reportQuestionAction(questionId: string, kind: community.ReportKind, body: string | null) {
  return run(async () => {
    const user = await requireUser();
    await community.reportQuestion(user.id, z.uuid().parse(questionId), kind, body);
  });
}

export async function appealAction(questionId: string, argument: string) {
  return run(async () => {
    const user = await requireUser();
    await community.fileAppeal(user.id, z.uuid().parse(questionId), argument);
  });
}

// ---------- Ligas e turmas ----------
export async function createGroupAction(form: FormData) {
  const user = await requireUser();
  await leagues.createGroup(user.id, String(form.get("name") ?? ""));
  revalidatePath("/app/ligas");
}

export async function joinGroupAction(form: FormData) {
  const user = await requireUser();
  await leagues.joinGroup(user.id, String(form.get("code") ?? ""));
  revalidatePath("/app/ligas");
}

export async function leaveGroupAction(form: FormData) {
  const user = await requireUser();
  await leagues.leaveGroup(user.id, z.uuid().parse(form.get("groupId")));
  revalidatePath("/app/ligas");
}

// ---------- Conta ----------
const profileSchema = z.object({
  nickname: z.string().trim().min(3).max(24).regex(/^[\p{L}\p{N}_.-]+$/u),
  schoolId: z.uuid().nullable(),
  showSchool: z.boolean(),
});

export async function updateProfileAction(_: AuthState, form: FormData): Promise<AuthState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    nickname: form.get("nickname"),
    schoolId: form.get("schoolId") || null,
    showSchool: form.get("showSchool") === "on",
  });
  if (!parsed.success) return { error: "O apelido precisa ter de 3 a 24 caracteres, sem espaços." };
  const { error } = await admin()
    .from("profiles")
    .update({ nickname: parsed.data.nickname, school_id: parsed.data.schoolId, show_school: parsed.data.showSchool })
    .eq("id", user.id);
  if (error?.code === "23505") return { error: "Esse apelido já está em uso." };
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/app", "layout");
  return { notice: "Perfil salvo." };
}

const boletimSchema = z.object({ score: z.number().min(0).max(1000), proficient: z.boolean().nullable() });

export async function saveBoletimAction(_: AuthState, form: FormData): Promise<AuthState> {
  const user = await requireUser();
  if (form.get("consent") !== "on") return { error: "É preciso autorizar o uso da nota para enviá-la." };
  const parsed = boletimSchema.safeParse({
    score: Number(String(form.get("score")).replace(",", ".")),
    proficient: form.get("proficient") === "sim" ? true : form.get("proficient") === "nao" ? false : null,
  });
  if (!parsed.success) return { error: "Informe uma nota válida." };
  await admin()
    .from("boletins")
    .upsert({ user_id: user.id, edition: 2026, score: parsed.data.score, proficient: parsed.data.proficient, consent_at: new Date().toISOString() });
  revalidatePath("/app/evolucao");
  return { notice: "Obrigado. Sua nota ajuda a calibrar o Termômetro." };
}

export async function deleteBoletimAction() {
  const user = await requireUser();
  await admin().from("boletins").delete().eq("user_id", user.id);
  revalidatePath("/app/evolucao");
}

/** LGPD: apaga a conta e todos os dados ligados a ela. */
export async function deleteAccountAction(form: FormData) {
  const user = await requireUser();
  if (form.get("confirm") !== "EXCLUIR") redirect("/app/conta?erro=confirmacao");
  const supabase = await createClient();
  await admin().auth.admin.deleteUser(user.id);
  await supabase.auth.signOut();
  redirect("/?conta=excluida");
}

// ---------- Assinatura ----------
export async function checkoutAction() {
  return run(async () => {
    const user = await requireUser();
    if (!stripeConfigured()) throw new AppError("closed", "O pagamento ainda não foi configurado neste ambiente.");
    return createCheckoutSession(user.id, user.email);
  });
}

export async function portalAction() {
  const user = await requireUser();
  redirect(await createPortalUrl(user.id));
}

export async function withdrawAction() {
  return run(async () => {
    const user = await requireUser();
    await withdrawSubscription(user.id);
    revalidatePath("/app", "layout");
  });
}

// ---------- Painel editorial ----------
export async function publishQuestionAction(form: FormData) {
  await requireEditor();
  await editorial.publishQuestion(z.uuid().parse(form.get("id")));
  revalidatePath("/admin");
}

export async function retireQuestionAction(form: FormData) {
  await requireEditor();
  const reason = z.string().trim().max(500).parse(form.get("reason") ?? "");
  await editorial.retireQuestion(z.uuid().parse(form.get("id")), reason || "Retirada no painel editorial");
  revalidatePath("/admin");
}

export async function markReviewedAction(form: FormData) {
  const { user } = await requireEditor();
  await editorial.markReviewed(user.id, z.uuid().parse(form.get("id")));
  revalidatePath("/admin");
}

export async function resolveReportAction(form: FormData) {
  await requireEditor();
  await editorial.resolveReport(z.uuid().parse(form.get("id")), form.get("status") === "resolvida" ? "resolvida" : "descartada");
  revalidatePath("/admin/moderacao");
}

export async function decideAppealAction(form: FormData) {
  const { user } = await requireEditor();
  await editorial.decideAppeal(
    user.id,
    z.uuid().parse(form.get("id")),
    form.get("status") === "deferido" ? "deferido" : "indeferido",
    String(form.get("note") ?? ""),
  );
  revalidatePath("/admin/moderacao");
}

export async function moderateCommentAction(form: FormData) {
  await requireEditor();
  const action = form.get("action");
  const id = z.uuid().parse(form.get("id"));
  if (action === "hide") await editorial.moderateComment(id, { hidden: true });
  if (action === "show") await editorial.moderateComment(id, { hidden: false });
  if (action === "pin") await editorial.moderateComment(id, { pinned: true });
  if (action === "unpin") await editorial.moderateComment(id, { pinned: false });
  revalidatePath("/admin/moderacao");
}

export async function currentProfileAction() {
  const user = await requireUser();
  return getProfile(user.id);
}
