import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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

export const PASSWORD = `Senha-de-teste-${randomUUID().slice(0, 8)}`;

export async function signUp(page: Page) {
  const email = `e2e-${randomUUID()}@exemplo.test`;
  await page.goto("/cadastrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/^Senha/).fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta grátis" }).click();
  await page.waitForURL(/\/app\/conta/);
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email)!;
  return { email, id: user.id };
}

export async function makePremium(userId: string) {
  await db
    .from("entitlements")
    .update({ plan: "premium", access_until: new Date(Date.now() + 30 * 86_400_000).toISOString() })
    .eq("user_id", userId);
}
