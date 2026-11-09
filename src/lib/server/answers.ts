import "server-only";
import { admin } from "@/lib/supabase/admin";
import { discriminationBucket, itemRatingAfter, PLACEMENT_GAMES, ratingDelta, tierOf } from "@/lib/game/rating";
import { nextStreak, todayBR } from "@/lib/game/streak";
import { levelOf, xpForAnswer, xpForDaily, type XpEntry } from "@/lib/game/xp";
import { scheduleCard, shouldSchedule, type Confidence } from "@/lib/study/srs";
import { AppError, enforceRateLimit, isPremium } from "./session";
import { getDailyIds } from "./daily";
import { getReveal, type Reveal } from "./questions";
import { grantAchievements } from "./progress";

export type AnswerInput = {
  questionId: string;
  mode: "daily" | "training" | "review";
  context: string;
  selected: number;
  confidence?: Confidence | null;
  ms?: number | null;
};

export type AnswerResult = {
  answerId: string | null;
  correct: boolean;
  selected: number;
  reveal: Reveal;
  xpGained: number;
  ratingDelta: number;
  ratingAfter: number;
  tierName: string;
  tierUp: boolean;
  placementLeft: number;
  combo: number;
  levelUp: string | null;
  streak: number;
  /** Trocas de plantão que o jogador tem depois desta resposta. */
  shields: number;
  usedShield: boolean;
  earnedShield: boolean;
  /** Combo antes desta resposta; permite mostrar "combo de N quebrado". */
  previousCombo: number;
  /** XP total acumulado depois desta resposta, já com bônus e conquistas. */
  xpTotal: number;
  /** Parte de xpGained que veio do bônus de conclusão do Plantão. */
  bonusXp: number;
  dailyFinished: { correct: number; total: number } | null;
  newAchievements: string[];
};

export async function submitAnswer(userId: string, input: AnswerInput): Promise<AnswerResult> {
  await enforceRateLimit(`answer:${userId}`, 90, 60);
  const db = admin();
  const today = todayBR();

  const { data: question } = await db
    .from("questions")
    .select("id, status, rating, options")
    .eq("id", input.questionId)
    .single();
  if (!question || question.status !== "published") throw new AppError("not_found", "Questão indisponível.");
  if (!Number.isInteger(input.selected) || input.selected < 0 || input.selected >= question.options.length) {
    throw new AppError("invalid", "Alternativa inválida.");
  }

  if (input.mode === "daily") {
    const ids = await getDailyIds(today);
    if (input.context !== today || !ids.includes(input.questionId)) {
      throw new AppError("closed", "Esta questão não faz parte do Plantão de hoje.");
    }
  } else if (!(await isPremium(userId))) {
    throw new AppError("premium_required", "Treino e revisão fazem parte da assinatura.");
  }

  const [{ data: keyRow }, { data: rating }, { data: streak }, { data: card }, { count: previous }] = await Promise.all([
    db.from("question_keys").select("correct_index").eq("question_id", input.questionId).single(),
    db.from("rating_state").select("*").eq("user_id", userId).single(),
    db.from("streaks").select("current, best, last_active, shields").eq("user_id", userId).single(),
    db.from("srs_cards").select("state").eq("user_id", userId).eq("question_id", input.questionId).maybeSingle(),
    db.from("answers").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("question_id", input.questionId),
  ]);

  const correct = keyRow.correct_index === input.selected;
  const firstTime = (previous ?? 0) === 0;
  const countsForRating = firstTime && input.mode !== "review";

  const delta = countsForRating ? ratingDelta(Number(rating.rating), Number(question.rating), correct, rating.games) : 0;
  const ratingAfterValue = Number(rating.rating) + delta;
  const games = rating.games + (countsForRating ? 1 : 0);
  const combo = correct ? rating.combo + 1 : 0;

  // Refazer questão no treino não rende XP: evita ganhar pontos repetindo o que já viu.
  const xp: XpEntry[] =
    firstTime || input.mode === "review" ? xpForAnswer({ questionId: input.questionId, mode: input.mode, context: input.context, correct }) : [];
  const xpGainedBase = xp.reduce((sum, e) => sum + e.amount, 0);

  const newStreak = nextStreak(streak, today);
  const srs = shouldSchedule({ correct, confidence: input.confidence, hasCard: Boolean(card) })
    ? scheduleCard(card?.state ?? null, correct, input.confidence)
    : null;

  const payload: Record<string, unknown> = {
    user_id: userId,
    question_id: input.questionId,
    mode: input.mode,
    context: input.context,
    selected: input.selected,
    is_correct: correct,
    confidence: input.confidence ?? null,
    ms: input.ms ?? null,
    rating_delta: delta,
    xp_total: xpGainedBase,
    xp,
    bucket: countsForRating ? discriminationBucket(Number(rating.rating), rating.games) : null,
    streak: { current: newStreak.current, best: newStreak.best, last_active: newStreak.last_active, shields: newStreak.shields },
    srs,
  };
  if (countsForRating) {
    payload.rating_after = ratingAfterValue;
    payload.combo_after = combo;
    payload.placement_done = games >= PLACEMENT_GAMES;
    payload.item_rating_after = itemRatingAfter(Number(rating.rating), Number(question.rating), correct);
  } else {
    await db.from("rating_state").update({ combo, best_combo: Math.max(rating.best_combo, combo) }).eq("user_id", userId);
  }

  const { data: applied, error } = await db.rpc("apply_answer", { p: payload });
  if (error) throw error;

  // Resposta repetida (duplo clique, recarga): devolve o resultado original sem pontuar de novo.
  if (!applied.inserted) {
    const { data: original } = await db
      .from("answers")
      .select("id, selected, is_correct, rating_delta, xp")
      .eq("user_id", userId)
      .eq("question_id", input.questionId)
      .eq("mode", input.mode)
      .eq("context", input.context)
      .single();
    const tier = tierOf(Number(rating.rating));
    return {
      answerId: original.id,
      correct: original.is_correct,
      selected: original.selected,
      reveal: await getReveal(input.questionId),
      xpGained: 0,
      ratingDelta: 0,
      ratingAfter: Number(rating.rating),
      tierName: tier.tier.name,
      tierUp: false,
      placementLeft: Math.max(0, PLACEMENT_GAMES - rating.games),
      combo: rating.combo,
      levelUp: null,
      streak: streak.current,
      shields: streak.shields,
      usedShield: false,
      earnedShield: false,
      previousCombo: rating.combo,
      xpTotal: rating.xp_total,
      bonusXp: 0,
      dailyFinished: null,
      newAchievements: [],
    };
  }

  let dailyFinished: AnswerResult["dailyFinished"] = null;
  let bonus = 0;
  if (input.mode === "daily") {
    const ids = await getDailyIds(today);
    const { data: done } = await db.from("answers").select("is_correct").eq("user_id", userId).eq("mode", "daily").eq("context", today);
    if ((done?.length ?? 0) >= ids.length) {
      const total = ids.length;
      const hits = done!.filter((d: { is_correct: boolean }) => d.is_correct).length;
      dailyFinished = { correct: hits, total };
      for (const entry of xpForDaily(today, hits, total)) {
        const { data: granted } = await db.rpc("award_xp", { p_user: userId, p_amount: entry.amount, p_kind: entry.kind, p_ref: entry.ref });
        if (granted) bonus += entry.amount;
      }
    }
  }

  const newAchievements = await grantAchievements(userId);
  const { data: totals } = await db.from("rating_state").select("xp_total").eq("user_id", userId).single();
  const before = levelOf(rating.xp_total);
  const after = levelOf(totals.xp_total);

  return {
    answerId: applied.answer_id,
    correct,
    selected: input.selected,
    reveal: await getReveal(input.questionId),
    xpGained: xpGainedBase + bonus,
    ratingDelta: delta,
    ratingAfter: ratingAfterValue,
    tierName: tierOf(ratingAfterValue).tier.name,
    tierUp: games >= PLACEMENT_GAMES && tierOf(ratingAfterValue).index > tierOf(Number(rating.rating)).index,
    placementLeft: Math.max(0, PLACEMENT_GAMES - games),
    combo,
    levelUp: after.index > before.index ? after.current.name : null,
    streak: newStreak.current,
    shields: newStreak.shields,
    usedShield: newStreak.usedShield,
    earnedShield: newStreak.earnedShield,
    previousCombo: rating.combo,
    xpTotal: totals.xp_total,
    bonusXp: bonus,
    dailyFinished,
    newAchievements,
  };
}

const ERROR_REASONS = ["conteudo", "leitura", "pressa", "chute", "entre_duas"] as const;
export type ErrorReason = (typeof ERROR_REASONS)[number];

/** Marcar o motivo do erro vale um pouco de XP, uma vez por resposta. */
export async function setErrorReason(userId: string, answerId: string, reason: ErrorReason) {
  if (!ERROR_REASONS.includes(reason)) throw new AppError("invalid", "Motivo inválido.");
  const db = admin();
  const { data: answer } = await db.from("answers").select("id, is_correct").eq("id", answerId).eq("user_id", userId).single();
  if (!answer) throw new AppError("not_found", "Resposta não encontrada.");
  if (answer.is_correct) throw new AppError("invalid", "Essa resposta está certa.");
  await db.from("answers").update({ error_reason: reason }).eq("id", answerId);
  await db.rpc("award_xp", { p_user: userId, p_amount: 3, p_kind: "diagnosed", p_ref: answerId });
}
