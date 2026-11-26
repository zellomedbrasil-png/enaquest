// Envia os trechos extraídos (materiais-privados/.extraido/trechos.jsonl) para a tabela privada material_chunks.
// Trecho que já existe com o mesmo texto mantém a classificação; se o texto mudou, volta para a fila.
// Uso: npm run materiais:enviar   (precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

type Chunk = { id: string; origem: string; arquivo: string; pagina_inicio: number; pagina_fim: number; texto: string };

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const chunks: Chunk[] = readFileSync("materiais-privados/.extraido/trechos.jsonl", "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  // O que já está no banco, para não apagar a classificação de trecho que não mudou.
  const existing = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("material_chunks").select("id, texto").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) existing.set(row.id, row.texto);
    if (!data || data.length < 1000) break;
  }

  const fresh = chunks.filter((c) => existing.get(c.id) !== c.texto);
  for (let i = 0; i < fresh.length; i += 200) {
    const batch = fresh.slice(i, i + 200).map((c) => ({ ...c, tipo: null, area_id: null, tema: null, assunto: null, classificado_em: null }));
    const { error } = await db.from("material_chunks").upsert(batch);
    if (error) throw new Error(error.message);
    process.stdout.write(`\r${Math.min(i + 200, fresh.length)}/${fresh.length} enviados`);
  }
  const keep = new Set(chunks.map((c) => c.id));
  const gone = [...existing.keys()].filter((id) => !keep.has(id));
  if (gone.length) {
    for (let i = 0; i < gone.length; i += 200) await db.from("material_chunks").delete().in("id", gone.slice(i, i + 200));
  }
  console.log(`\n${chunks.length} trechos no total: ${fresh.length} novos ou alterados, ${chunks.length - fresh.length} sem mudança, ${gone.length} removidos.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
