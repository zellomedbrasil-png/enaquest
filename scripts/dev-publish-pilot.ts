// Só para testar a interface no computador: publica o lote localmente, sem revisão.
// Fica marcado como "Verificada por IA" e recusa rodar fora do ambiente local.
// A aprovação de verdade acontece no painel editorial.
// Uso: npm run dev:publish-pilot -- piloto-001
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

async function main() {
  const lotId = process.argv[2] ?? "piloto-001";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Este script só roda no ambiente local.");
  const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { error, count } = await db
    .from("questions")
    .update({ status: "published", verification: "ia_verificada", published_at: new Date().toISOString() }, { count: "exact" })
    .eq("lot_id", lotId);
  if (error) throw error;
  console.log(`${count} questões do lote ${lotId} publicadas só neste ambiente local, sem revisão médica.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
