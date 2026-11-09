// Sobe o app local com os valores do Supabase local, sem precisar de arquivo de ambiente.
// Uso: node scripts/dev-local.mjs [dev|build|start]
import { execSync, spawn } from "node:child_process";

const status = execSync("npx supabase status -o env", { encoding: "utf8" });
const read = (name) => status.match(new RegExp(`^${name}="?([^"\\r\\n]+)"?`, "m"))?.[1] ?? "";

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: read("API_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: read("ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: read("SERVICE_ROLE_KEY"),
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  CRON_SECRET: process.env.CRON_SECRET ?? "segredo-so-para-desenvolvimento-local",
};

const command = process.argv[2] ?? "dev";
const child = spawn("npx", ["next", command, ...process.argv.slice(3)], { stdio: "inherit", shell: true, env });
child.on("exit", (code) => process.exit(code ?? 0));
