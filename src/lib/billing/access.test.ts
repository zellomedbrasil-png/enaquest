import { describe, expect, it } from "vitest";
import { canWithdraw, entitlementFromSubscription, GRACE_DAYS, hasPremiumAccess } from "./access";

const now = new Date("2026-11-09T12:00:00Z");
const end = new Date("2026-12-09T12:00:00Z");

describe("acesso", () => {
  it("nega sem data ou com data vencida", () => {
    expect(hasPremiumAccess(null, now)).toBe(false);
    expect(hasPremiumAccess({ plan: "free", access_until: null }, now)).toBe(false);
    expect(hasPremiumAccess({ plan: "premium", access_until: "2026-11-09T11:59:59Z" }, now)).toBe(false);
  });
  it("libera dentro do período", () => {
    expect(hasPremiumAccess({ plan: "premium", access_until: end.toISOString() }, now)).toBe(true);
  });
  it("assinatura ativa libera até o fim do período", () => {
    const e = entitlementFromSubscription({ status: "active", currentPeriodEnd: end });
    expect(e).toEqual({ plan: "premium", accessUntil: end, paymentProblem: false });
  });
  it("cobrança falha dá tolerância e avisa", () => {
    const e = entitlementFromSubscription({ status: "past_due", currentPeriodEnd: end });
    expect(e.paymentProblem).toBe(true);
    expect(e.accessUntil!.getTime()).toBe(end.getTime() + GRACE_DAYS * 86_400_000);
  });
  it("cancelamento mantém o que já foi pago até o fim do período", () => {
    const e = entitlementFromSubscription({ status: "canceled", currentPeriodEnd: end });
    expect(e.plan).toBe("free");
    expect(e.accessUntil).toEqual(end);
    expect(hasPremiumAccess({ plan: e.plan, access_until: e.accessUntil!.toISOString() }, now)).toBe(true);
  });
  it("assinatura não paga bloqueia", () => {
    for (const status of ["unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(entitlementFromSubscription({ status, currentPeriodEnd: end }).accessUntil).toBeNull();
    }
  });
  it("direito de arrependimento vale por 7 dias", () => {
    expect(canWithdraw("2026-11-02T12:00:00Z", now)).toBe(true);
    expect(canWithdraw("2026-11-02T11:59:00Z", now)).toBe(false);
    expect(canWithdraw(null, now)).toBe(false);
  });
});
