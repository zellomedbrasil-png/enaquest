import "server-only";
import { admin } from "@/lib/supabase/admin";
import { todayBR } from "@/lib/game/streak";
import { XP } from "@/lib/game/xp";
import { AppError, enforceRateLimit } from "./session";

async function assertAnswered(userId: string, questionId: string) {
  const { count } = await admin()
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("question_id", questionId);
  if (!count) throw new AppError("invalid", "Responda à questão para participar da discussão.");
}

export type CommentView = {
  id: string;
  nickname: string;
  body: string;
  votes: number;
  pinned: boolean;
  votedByMe: boolean;
  mine: boolean;
  createdAt: string;
};

export async function listComments(userId: string, questionId: string): Promise<CommentView[]> {
  await assertAnswered(userId, questionId);
  const db = admin();
  const { data, error } = await db
    .from("comments")
    .select("id, body, votes, pinned, created_at, user_id, profiles!comments_user_id_fkey(nickname)")
    .eq("question_id", questionId)
    .eq("hidden", false)
    .order("pinned", { ascending: false })
    .order("votes", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const { data: votes } = await db.from("comment_votes").select("comment_id").eq("user_id", userId).in("comment_id", rows.map((r) => r.id));
  const voted = new Set((votes ?? []).map((v: { comment_id: string }) => v.comment_id));
  return rows.map((row) => ({
    id: row.id,
    nickname: row.profiles?.nickname ?? "plantonista",
    body: row.body,
    votes: row.votes,
    pinned: row.pinned,
    votedByMe: voted.has(row.id),
    mine: row.user_id === userId,
    createdAt: row.created_at,
  }));
}

export async function addComment(userId: string, questionId: string, body: string) {
  await assertAnswered(userId, questionId);
  await enforceRateLimit(`comment:${userId}`, 10, 3600);
  const text = body.trim();
  if (text.length < 3 || text.length > 1500) throw new AppError("invalid", "O comentário precisa ter entre 3 e 1.500 caracteres.");
  const { error } = await admin().from("comments").insert({ question_id: questionId, user_id: userId, body: text });
  if (error) throw error;
}

export async function voteComment(userId: string, commentId: string): Promise<number> {
  const db = admin();
  await enforceRateLimit(`vote:${userId}`, 60, 3600);
  const { data: comment } = await db.from("comments").select("id, user_id, question_id").eq("id", commentId).single();
  if (!comment) throw new AppError("not_found", "Comentário não encontrado.");
  if (comment.user_id === userId) throw new AppError("invalid", "Não é possível votar no próprio comentário.");
  await assertAnswered(userId, comment.question_id);
  const { data: votes } = await db.rpc("vote_comment", { p_user: userId, p_comment: commentId });

  // Comentário útil rende XP ao autor, com teto diário para não virar fazenda de pontos.
  const day = todayBR();
  const { data: earned } = await db
    .from("xp_ledger")
    .select("amount")
    .eq("user_id", comment.user_id)
    .eq("kind", "comment_vote")
    .gte("created_at", `${day}T00:00:00-03:00`);
  const total = (earned ?? []).reduce((sum: number, row: { amount: number }) => sum + row.amount, 0);
  if (total < XP.commentVoteDailyCap) {
    await db.rpc("award_xp", { p_user: comment.user_id, p_amount: XP.commentVote, p_kind: "comment_vote", p_ref: `${commentId}:${userId}` });
  }
  return votes;
}

const REPORT_KINDS = ["gabarito", "desatualizada", "enunciado", "comentario", "ofensivo", "outro"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export async function reportQuestion(userId: string, questionId: string, kind: ReportKind, body: string | null) {
  if (!REPORT_KINDS.includes(kind)) throw new AppError("invalid", "Tipo de denúncia inválido.");
  await assertAnswered(userId, questionId);
  await enforceRateLimit(`report:${userId}`, 20, 3600);
  const db = admin();
  const { error } = await db
    .from("reports")
    .insert({ question_id: questionId, user_id: userId, kind, body: body?.slice(0, 1000) ?? null });
  // 23505: esta pessoa já denunciou esta questão por este motivo; não conta duas vezes.
  if (error && error.code !== "23505") throw error;
  await db.rpc("check_quarantine", { p_question: questionId });
}

export async function reportComment(userId: string, commentId: string) {
  await enforceRateLimit(`report:${userId}`, 20, 3600);
  const db = admin();
  await db.from("reports").insert({ comment_id: commentId, user_id: userId, kind: "ofensivo" });
  const { count } = await db.from("reports").select("id", { count: "exact", head: true }).eq("comment_id", commentId).eq("status", "aberta");
  if ((count ?? 0) >= 3) await db.from("comments").update({ hidden: true }).eq("id", commentId);
}

export async function fileAppeal(userId: string, questionId: string, argument: string) {
  await assertAnswered(userId, questionId);
  await enforceRateLimit(`appeal:${userId}`, 5, 86400);
  const text = argument.trim();
  if (text.length < 20) throw new AppError("invalid", "Explique o recurso em pelo menos 20 caracteres.");
  const { error } = await admin().from("appeals").insert({ question_id: questionId, user_id: userId, argument: text.slice(0, 2000) });
  if (error?.code === "23505") throw new AppError("invalid", "Você já enviou um recurso para esta questão.");
  if (error) throw error;
}
