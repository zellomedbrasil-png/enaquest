import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { admin } from "@/lib/supabase/admin";

export const db = () => admin();

export async function createUser(): Promise<{ id: string; email: string; client: SupabaseClient }> {
  const email = `teste-${randomUUID()}@exemplo.test`;
  const password = `Senha-${randomUUID()}`;
  const { data, error } = await db().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return { id: data.user.id, email, client };
}

export async function makePremium(userId: string, until = new Date(Date.now() + 30 * 86_400_000)) {
  await db().from("entitlements").update({ plan: "premium", access_until: until.toISOString() }).eq("user_id", userId);
}

/** Questões artificiais, só para testar o motor. Nunca vão para produção. */
export async function createQuestions(count: number, areaId = "clinica", extra: Record<string, unknown> = {}): Promise<{ id: string; correct: number; slug: string }[]> {
  const out = [];
  for (let i = 0; i < count; i++) {
    const correct = i % 4;
    const slug = `teste-${randomUUID()}`;
    const { data, error } = await db()
      .from("questions")
      .insert({
        slug,
        track_id: "enamed",
        area_id: areaId,
        competency_id: "decisao",
        theme: "Questão de teste",
        scenario: "UBS",
        difficulty: "medio",
        rating: 1300,
        stem: `Enunciado de teste ${i}. Qual é a alternativa marcada como correta?`,
        options: ["Opção um", "Opção dois", "Opção três", "Opção quatro"],
        status: "published",
        ...extra,
      })
      .select("id")
      .single();
    if (error) throw error;
    await db().from("question_keys").insert({ question_id: data.id, correct_index: correct });
    await db().from("explanations").insert({
      question_id: data.id,
      quick: "Resumo de teste",
      reasoning: "Raciocínio de teste",
      distractors: [],
      tip: "Macete de teste",
      pearl: "Armadilha de teste",
      competency_note: "Nota de teste",
    });
    out.push({ id: data.id, correct, slug });
  }
  return out;
}

/** Evita que as questões artificiais de um teste caiam no sorteio de outro. */
export async function clearDaily(day: string) {
  await db().from("daily_challenges").delete().eq("day", day);
}
