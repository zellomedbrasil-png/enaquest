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
import { getDueReviews, startTraining, type TrainingFilter } from "@/lib/server/study";
import { finishSimulado, saveSimuladoProgress } from "@/lib/server/simulados";
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

// ---------- Autenticação ----------
const credentials = z.object({ email: z.email(), password: z.string().min(8).max(72) });

export type AuthState = { error?: string; notice?: string; email?: string };

function safeNext(value: FormDataEntryValue | null): string {
  return safePath(value);
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Informe um e-mail válido e uma senha de pelo menos 8 caracteres.", email: String(form.get("email") ?? "") };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos.", email: parsed.data.email };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Informe um e-mail válido e uma senha de pelo menos 8 caracteres.", email: String(form.get("email") ?? "") };
  if (form.get("accept") !== "on") return { error: "Para criar a conta, aceite os termos de uso e a política de privacidade.", email: parsed.data.email };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/app/boas-vindas")}` },
  });
  if (error) return { error: "Não foi possível criar a conta. Confira os dados e tente de novo.", email: parsed.data.email };
  if (!data.session) return { notice: "Enviamos um link de confirmação para o seu e-mail." };
  redirect("/app/boas-vindas");
}

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/nova-senha`,
  });
  // A resposta é a mesma exista ou não a conta, para não revelar quem está cadastrado.
  return { notice: "Se esse e-mail estiver cadastrado, enviamos o link para criar uma nova senha." };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const password = z.string().min(8).max(72).safeParse(form.get("password"));
  if (!password.success) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: "Não foi possível alterar a senha. Peça um novo link." };
  redirect("/app");
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
const lookSchema = z.object({
  character: z.string().max(40),
  body: z.string().max(40),
  head: z.string().max(40).nullable(),
  accessory: z.string().max(40).nullable(),
  background: z.string().max(40),
});

export async function buyItemAction(itemId: string) {
  return run(async () => {
    const user = await requireUser();
    const view = await mascot.buyItem(user.id, z.string().min(1).max(40).parse(itemId));
    revalidatePath("/app", "layout");
    return view;
  });
}

export async function equipAction(look: z.input<typeof lookSchema>) {
  return run(async () => {
    const user = await requireUser();
    const view = await mascot.equip(user.id, lookSchema.parse(look));
    revalidatePath("/app", "layout");
    return view;
  });
}

export async function renameMascotAction(name: string) {
  return run(async () => {
    const user = await requireUser();
    const saved = await mascot.renameMascot(user.id, z.string().max(60).parse(name));
    revalidatePath("/app", "layout");
    return saved;
  });
}

export async function errorReasonAction(answerId: string, reason: ErrorReason) {
  return run(async () => {
    const user = await requireUser();
    await setErrorReason(user.id, z.uuid().parse(answerId), reason);
  });
}

export async function startTrainingAction(input: { areaId: string | null; filter: TrainingFilter; size: number }) {
  return run(async () => {
    const user = await requireUser();
    return startTraining(user.id, input);
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
const decisionSchema = z.object({
  lotId: z.string().min(1),
  questionId: z.uuid(),
  decision: z.enum(["ok", "minor", "critical"]),
  notes: z.string().max(2000).nullable(),
});

export async function decideSampleAction(form: FormData) {
  const { user } = await requireEditor();
  const input = decisionSchema.parse({
    lotId: form.get("lotId"),
    questionId: form.get("questionId"),
    decision: form.get("decision"),
    notes: (form.get("notes") as string) || null,
  });
  if (input.decision !== "ok" && !input.notes) {
    redirect(`/admin/lotes/${input.lotId}?erro=nota#q-${input.questionId}`);
  }
  await editorial.decideSample(user.id, input);
  revalidatePath(`/admin/lotes/${input.lotId}`);
}

export async function approveLotAction(form: FormData) {
  const { user } = await requireEditor();
  const lotId = String(form.get("lotId"));
  await editorial.approveLot(user.id, lotId);
  revalidatePath("/admin", "layout");
  redirect("/admin");
}

export async function rejectLotAction(form: FormData) {
  const { user } = await requireEditor();
  await editorial.rejectLot(user.id, String(form.get("lotId")), String(form.get("reason") || "Rejeitado na revisão"));
  revalidatePath("/admin", "layout");
  redirect("/admin");
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

export async function setQuestionStatusAction(form: FormData) {
  await requireEditor();
  const status = form.get("status");
  if (status !== "published" && status !== "retired") throw new AppError("invalid", "Status inválido.");
  await editorial.setQuestionStatus(z.uuid().parse(form.get("id")), status);
  revalidatePath("/admin/moderacao");
}

export async function currentProfileAction() {
  const user = await requireUser();
  return getProfile(user.id);
}
