/**
 * Caminho interno seguro para redirecionar depois do login ou da confirmação de e-mail.
 * Só aceita caminhos do próprio site: recusa endereços completos, "//site" e "/\site"
 * (o navegador trata a barra invertida como barra normal) e caracteres de controle.
 */
export function safePath(value: unknown, fallback = "/app"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
