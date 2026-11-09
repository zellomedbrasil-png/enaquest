// Cria .env.local para desenvolvimento com os valores do Supabase local.
// Uso: node scripts/setup-env.mjs (com o Supabase local no ar).
import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (existsSync(".env.local")) {
  console.log(".env.local já existe. Nada foi alterado.");
  process.exit(0);
}

const status = execSync("npx supabase status -o env", { encoding: "utf8" });
const read = (name) => status.match(new RegExp(`^${name}="?([^"\\n]+)"?`, "m"))?.[1] ?? "";

const lines = [
  `NEXT_PUBLIC_SUPABASE_URL=${read("API_URL")}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${read("ANON_KEY")}`,
  `SUPABASE_SERVICE_ROLE_KEY=${read("SERVICE_ROLE_KEY")}`,
  "NEXT_PUBLIC_APP_URL=http://localhost:3000",
  "STRIPE_SECRET_KEY=",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=",
  "STRIPE_WEBHOOK_SECRET=",
  "STRIPE_PRICE_ID=",
  `CRON_SECRET=${randomBytes(24).toString("hex")}`,
  "ANTHROPIC_API_KEY=",
];
writeFileSync(".env.local", lines.join("\n") + "\n");
console.log(".env.local criado. Falta preencher as chaves de teste da Stripe.");
