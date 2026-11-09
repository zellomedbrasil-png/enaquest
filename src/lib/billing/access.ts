// Regras de acesso. A assinatura da Stripe vira uma única data: access_until.
// Separar isso permite trazer Pix ou outro meio depois, sem refazer o controle de acesso.

export const GRACE_DAYS = 3;
export const WITHDRAWAL_DAYS = 7;
const DAY = 86_400_000;

export type Entitlement = { plan: "free" | "premium"; access_until: string | null; payment_problem?: boolean };

export function hasPremiumAccess(entitlement: Entitlement | null | undefined, now: Date = new Date()): boolean {
  if (!entitlement?.access_until) return false;
  return new Date(entitlement.access_until).getTime() > now.getTime();
}

export type SubscriptionSnapshot = {
  status: string;
  currentPeriodEnd: Date | null;
};

/** Traduz o estado da assinatura em data de acesso e aviso de problema no pagamento. */
export function entitlementFromSubscription(sub: SubscriptionSnapshot): {
  plan: "free" | "premium";
  accessUntil: Date | null;
  paymentProblem: boolean;
} {
  const end = sub.currentPeriodEnd;
  switch (sub.status) {
    case "active":
    case "trialing":
      return { plan: "premium", accessUntil: end, paymentProblem: false };
    case "past_due":
      return {
        plan: "premium",
        accessUntil: end ? new Date(end.getTime() + GRACE_DAYS * DAY) : null,
        paymentProblem: true,
      };
    case "canceled":
      // Cancelou: mantém o que já pagou até o fim do período.
      return { plan: "free", accessUntil: end, paymentProblem: false };
    default:
      // incomplete, incomplete_expired, unpaid, paused
      return { plan: "free", accessUntil: null, paymentProblem: sub.status === "unpaid" };
  }
}

/** Direito de arrependimento: 7 dias desde o primeiro pagamento (CDC, art. 49). */
export function canWithdraw(firstPaidAt: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!firstPaidAt) return false;
  const paid = new Date(firstPaidAt).getTime();
  return now.getTime() - paid <= WITHDRAWAL_DAYS * DAY;
}
