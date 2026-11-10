import { describe, expect, it } from "vitest";
import { safePath } from "./safe-path";

describe("safePath", () => {
  it("aceita caminhos do próprio site, com parâmetros", () => {
    expect(safePath("/app")).toBe("/app");
    expect(safePath("/app/mascote?aba=roupas#topo")).toBe("/app/mascote?aba=roupas#topo");
  });
  it("recusa endereço completo e protocolo relativo", () => {
    expect(safePath("https://evil.com")).toBe("/app");
    expect(safePath("//evil.com")).toBe("/app");
    expect(safePath("evil.com")).toBe("/app");
  });
  it("recusa a barra invertida, que o navegador lê como barra", () => {
    expect(safePath("/\\evil.com")).toBe("/app");
    expect(safePath("/app\\..\\x")).toBe("/app");
  });
  it("recusa caracteres de controle e valores que não são texto", () => {
    expect(safePath("/app\r\nSet-Cookie: x=1")).toBe("/app");
    expect(safePath("/\tevil")).toBe("/app");
    expect(safePath(null)).toBe("/app");
    expect(safePath(undefined)).toBe("/app");
    expect(safePath(42)).toBe("/app");
  });
  it("usa o destino padrão informado", () => {
    expect(safePath("//x", "/entrar")).toBe("/entrar");
  });
});
