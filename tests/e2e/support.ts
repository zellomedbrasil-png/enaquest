import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

const status = execSync("npx supabase status -o env", { encoding: "utf8" });
const read = (name: string) => status.match(new RegExp(`^${name}="?([^"\\r\\n]+)"?`, "m"))?.[1] ?? "";

export const db = createClient(read("API_URL"), read("SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

export const SECRET_TIP = `SEGREDO-${randomUUID()}`;

/** Questões artificiais, só para testar a interface. */
export async function makeQuestions(count: number, marker = "E2E") {
  const out: { id: string; correct: number; slug: string }[] = [];
  for (let i = 0; i < count; i++) {
    const correct = i % 4;
    const slug = `e2e-${randomUUID()}`;
    const { data, error } = await db
      .from("questions")
      .insert({
        slug,
        track_id: "enamed",
        area_id: ["clinica", "pediatria", "go", "cirurgia", "mental", "coletiva", "mfc"][i % 7],
        competency_id: "decisao",
        theme: `Tema ${marker} ${i + 1}`,
        scenario: "UBS",
        difficulty: "medio",
        rating: 1300,
        stem: `Caso de teste ${marker} número ${i + 1}. Qual é a conduta?`,
        options: ["Primeira opção", "Segunda opção", "Terceira opção", "Quarta opção"],
        status: "published",
      })
      .select("id")
      .single();
    if (error) throw error;
    await db.from("question_keys").insert({ question_id: data!.id, correct_index: correct });
    await db.from("explanations").insert({
      question_id: data!.id,
      quick: `Resumo ${SECRET_TIP}`,
      reasoning: "Raciocínio de teste com mais de quatro palavras.",
      distractors: [0, 1, 2, 3].filter((x) => x !== correct).map((index) => ({ index, why: `Por que a ${index} está errada.` })),
      tip: "Macete de teste com várias palavras.",
      pearl: "Armadilha de teste com várias palavras.",
      competency_note: "Nota de competência de teste com palavras.",
    });
    out.push({ id: data!.id, correct, slug });
  }
  return out;
}

export function todayBR() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const PASSWORD = `Senha-de-teste-${randomUUID().slice(0, 8)}`;

/**
 * A tela só oferece o Google, que não dá para automatizar. Nos testes a sessão nasce direto no
 * Supabase local e os cookies dela vão para o navegador.
 */
export async function signIn(page: Page, email: string) {
  const jar: { name: string; value: string }[] = [];
  const client = createServerClient(read("API_URL"), read("ANON_KEY"), {
    cookies: { getAll: () => [], setAll: (toSet) => void jar.push(...toSet) },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  await page.goto("/entrar");
  const url = new URL(page.url()).origin;
  await page.context().addCookies(jar.filter((c) => c.value).map(({ name, value }) => ({ name, value, url })));
}

/** Cria uma conta de teste, entra e para no onboarding, como um aluno novo. */
export async function signUp(page: Page) {
  const email = `e2e-${randomUUID()}@exemplo.test`;
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  await signIn(page, email);
  await page.goto("/comecar");
  return { email, id: data.user.id };
}

export async function makePremium(userId: string) {
  await db
    .from("entitlements")
    .update({ plan: "premium", access_until: new Date(Date.now() + 30 * 86_400_000).toISOString() })
    .eq("user_id", userId);
}
