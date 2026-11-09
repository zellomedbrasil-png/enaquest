// Só para desenvolvimento: prepara o ambiente local para ver o app funcionando.
// Limpa o banco local, importa o piloto, publica sem revisão, cria o simulado
// e uma conta de demonstração com assinatura ativa e papel de administrador.
// Recusa rodar fora do Supabase local. Uso: node scripts/dev-seed-demo.mjs
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const status = execSync("npx supabase status -o env", { encoding: "utf8" });
const read = (name) => status.match(new RegExp(`^${name}="?([^"\\r\\n]+)"?`, "m"))?.[1] ?? "";
const url = read("API_URL");
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Este script só roda no ambiente local.");

const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: read("SERVICE_ROLE_KEY") };
execSync("npx supabase db reset", { stdio: "ignore" });
execSync("npx tsx scripts/import-lot.ts content/lots/piloto-001.json", { stdio: "inherit", env });
execSync("npx tsx scripts/dev-publish-pilot.ts piloto-001", { stdio: "inherit", env });

const db = createClient(url, read("SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const { data: questions } = await db.from("questions").select("id").eq("lot_id", "piloto-001");
await db.from("simulados").insert({
  title: "Simulado Piloto (só 60 questões)",
  opens_at: new Date(Date.now() - 3_600_000).toISOString(),
  closes_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  duration_minutes: 180,
  question_ids: questions.map((q) => q.id),
  published: true,
});

const email = "demo@enaquest.test";
// Senha fixa de propósito: esta conta só existe no banco local e o script recusa outros ambientes.
const password = "demo-local-enaquest";
const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
const id = created.user.id;
await db.from("profiles").update({ role: "admin", nickname: "plantonista_demo" }).eq("id", id);
await db.from("entitlements").update({ plan: "premium", access_until: new Date(Date.now() + 365 * 86_400_000).toISOString() }).eq("user_id", id);

console.log(`\nPronto. Entre em http://localhost:3000/entrar\nE-mail: ${email}\nSenha: ${password}`);
