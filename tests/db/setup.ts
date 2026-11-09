// Os testes usam o Supabase local e pegam os valores direto do CLI.
// Eles se recusam a rodar contra qualquer banco que não seja local.
import { execSync } from "node:child_process";

const status = execSync("npx supabase status -o env", { encoding: "utf8" });
const read = (name: string) => status.match(new RegExp(`^${name}="?([^"\\r\\n]+)"?`, "m"))?.[1] ?? "";

process.env.NEXT_PUBLIC_SUPABASE_URL = read("API_URL");
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = read("ANON_KEY");
process.env.SUPABASE_SERVICE_ROLE_KEY = read("SERVICE_ROLE_KEY");
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

if (!/127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  throw new Error("Os testes de banco só rodam no ambiente local.");
}
