import Stripe from "stripe";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createUser, db } from "./helpers";
import { hasPremiumAccess } from "@/lib/billing/access";
import { POST } from "@/app/api/stripe/webhook/route";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const SECRET = "whsec_valor_apenas_para_este_teste";

function signedRequest(payload: string, secret = SECRET) {
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost:3000/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } });
}

describe("rota do webhook da Stripe", () => {
  beforeAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    process.env.STRIPE_SECRET_KEY = "sk_test_valor_apenas_para_este_teste";
  });

  async function subscriptionEvent() {
    const user = await createUser();
    const customer = `cus_${randomUUID()}`;
    await db().from("stripe_customers").insert({ user_id: user.id, stripe_customer_id: customer });
    const payload = JSON.stringify({
      id: `evt_${randomUUID()}`,
      object: "event",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: `sub_${randomUUID()}`,
          object: "subscription",
          customer,
          status: "active",
          metadata: {},
          cancel_at_period_end: false,
          items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 2_592_000, price: { id: "price_test" } }] },
        },
      },
    });
    return { user, payload };
  }

  const access = async (id: string) => (await db().from("entitlements").select("plan, access_until").eq("user_id", id).single()).data;

  it("aceita evento assinado e libera o acesso", async () => {
    const { user, payload } = await subscriptionEvent();
    const response = await POST(signedRequest(payload));
    expect(response.status).toBe(200);
    expect((await response.json()).outcome).toBe("processed");
    expect(hasPremiumAccess(await access(user.id))).toBe(true);
  });

  it("recusa evento com assinatura de outro segredo, sem liberar nada", async () => {
    const { user, payload } = await subscriptionEvent();
    const response = await POST(signedRequest(payload, "whsec_segredo_errado"));
    expect(response.status).toBe(400);
    expect(hasPremiumAccess(await access(user.id))).toBe(false);
  });

  it("recusa evento sem assinatura", async () => {
    const { user, payload } = await subscriptionEvent();
    const response = await POST(new Request("http://localhost:3000/api/stripe/webhook", { method: "POST", body: payload }));
    expect(response.status).toBe(400);
    expect(hasPremiumAccess(await access(user.id))).toBe(false);
  });

  it("recusa corpo alterado depois de assinado", async () => {
    const { user, payload } = await subscriptionEvent();
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const tampered = payload.replace("active", "trialing");
    const response = await POST(new Request("http://localhost:3000/api/stripe/webhook", { method: "POST", body: tampered, headers: { "stripe-signature": signature } }));
    expect(response.status).toBe(400);
    expect(hasPremiumAccess(await access(user.id))).toBe(false);
  });

  it("responde 500 quando falha, para a Stripe tentar de novo", async () => {
    const payload = JSON.stringify({
      id: `evt_${randomUUID()}`,
      object: "event",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_x", customer: `cus_${randomUUID()}`, status: "active", metadata: {}, cancel_at_period_end: false, items: { data: [] } } },
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(signedRequest(payload));
    log.mockRestore();
    expect(response.status).toBe(500);
  });
});
