import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { createQuestions, createUser, db } from "./helpers";

describe("segurança: o que o navegador consegue ler direto do banco", () => {
  let alice: Awaited<ReturnType<typeof createUser>>;
  let bob: Awaited<ReturnType<typeof createUser>>;
  let question: { id: string };

  beforeAll(async () => {
    alice = await createUser();
    bob = await createUser();
    [question] = await createQuestions(1);
    await db().from("answers").insert({ user_id: alice.id, question_id: question.id, mode: "training", context: "x", selected: 0, is_correct: true });
  });

  it("usuário logado não lê gabarito", async () => {
    const { data, error } = await alice.client.from("question_keys").select("*");
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });
  it("usuário logado não lê comentário da questão", async () => {
    const { data } = await alice.client.from("explanations").select("*");
    expect(data ?? []).toHaveLength(0);
  });
  it("usuário logado não lê o banco de questões direto", async () => {
    const { data } = await alice.client.from("questions").select("*");
    expect(data ?? []).toHaveLength(0);
  });
  it("visitante não lê nada sensível", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    for (const table of ["questions", "question_keys", "explanations", "profiles", "answers", "entitlements", "subscriptions", "payments", "comments"]) {
      const { data } = await anon.from(table).select("*").limit(1);
      expect(data ?? [], table).toHaveLength(0);
    }
  });
  it("cada um vê só as próprias respostas", async () => {
    expect((await alice.client.from("answers").select("*")).data).toHaveLength(1);
    expect((await bob.client.from("answers").select("*")).data).toHaveLength(0);
  });
  it("um usuário não lê o perfil do outro", async () => {
    const { data } = await bob.client.from("profiles").select("*");
    expect(data?.map((p) => p.id)).toEqual([bob.id]);
  });
  it("usuário não consegue se dar acesso pago", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await alice.client.from("entitlements").update({ plan: "premium", access_until: future }).eq("user_id", alice.id);
    const { data } = await db().from("entitlements").select("plan, access_until").eq("user_id", alice.id).single();
    expect(data.plan).toBe("free");
    expect(data.access_until).toBeNull();
  });
  it("usuário não consegue mudar o próprio rating nem virar administrador", async () => {
    await alice.client.from("rating_state").update({ rating: 3000 }).eq("user_id", alice.id);
    await alice.client.from("profiles").update({ role: "admin" }).eq("id", alice.id);
    const rating = await db().from("rating_state").select("rating").eq("user_id", alice.id).single();
    const profile = await db().from("profiles").select("role").eq("id", alice.id).single();
    expect(Number(rating.data.rating)).toBe(900);
    expect(profile.data.role).toBe("student");
  });
  it("usuário não consegue inserir resposta nem XP direto", async () => {
    const inserted = await alice.client.from("answers").insert({ user_id: alice.id, question_id: question.id, mode: "training", context: "fraude", selected: 0, is_correct: true });
    const xp = await alice.client.from("xp_ledger").insert({ user_id: alice.id, amount: 9999, kind: "fraude", ref: "x" });
    expect(inserted.error).not.toBeNull();
    expect(xp.error).not.toBeNull();
  });
  it("usuário não chama as funções internas de pontuação", async () => {
    const award = await alice.client.rpc("award_xp", { p_user: alice.id, p_amount: 9999, p_kind: "fraude", p_ref: "y" });
    const apply = await alice.client.rpc("apply_answer", { p: {} });
    expect(award.error).not.toBeNull();
    expect(apply.error).not.toBeNull();
  });
  it("todas as tabelas públicas têm RLS ligada", async () => {
    const tables = ["profiles", "rating_state", "streaks", "entitlements", "questions", "question_keys", "explanations", "answers", "srs_cards", "xp_ledger", "comments", "reports", "appeals", "subscriptions", "payments", "stripe_events", "league_members", "groups", "group_members", "simulados", "simulado_attempts", "boletins"];
    for (const table of tables) {
      const { data } = await alice.client.from(table).select("*").limit(50);
      const leaked = (data ?? []).filter((row: Record<string, unknown>) => {
        const owner = row.user_id ?? (table === "profiles" ? row.id : undefined);
        return owner !== undefined && owner !== alice.id;
      });
      expect(leaked, table).toHaveLength(0);
    }
  });
  it("cria perfil, rating e acesso grátis ao cadastrar", async () => {
    const profile = await db().from("profiles").select("nickname, role").eq("id", bob.id).single();
    const entitlement = await db().from("entitlements").select("plan, access_until").eq("user_id", bob.id).single();
    expect(profile.data.nickname).toMatch(/^plantonista_/);
    expect(entitlement.data).toEqual({ plan: "free", access_until: null });
  });
});
