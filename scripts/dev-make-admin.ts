// Só para desenvolvimento: transforma uma conta em administradora.
// Uso: npm run dev:make-admin -- email@exemplo.com
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

async function main() {
  const email = process.argv[2];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Este script só roda no ambiente local.");
  if (!email) throw new Error("Informe o e-mail.");
  const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data } = await db.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error("Conta não encontrada.");
  const { error } = await db.from("profiles").update({ role: "admin" }).eq("id", user.id);
  if (error) throw error;
  console.log(`${email} agora é administrador neste ambiente local.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
