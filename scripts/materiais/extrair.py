"""Extrai o texto dos PDFs de materiais-privados/ e corta em trechos para o banco.

Roda só no computador (os arquivos não vão para o GitHub). Saída:
  materiais-privados/.extraido/trechos.jsonl   (um trecho por linha)

Uso: python scripts/materiais/extrair.py
Depois: npm run materiais:enviar
"""
import hashlib
import json
import re
import sys
from pathlib import Path

import pymupdf  # PyMuPDF

RAIZ = Path("materiais-privados")
SAIDA = RAIZ / ".extraido" / "trechos.jsonl"
TAMANHO = 3500  # caracteres por trecho, aproximadamente
MINIMO = 400  # trecho menor que isso junta com o próximo


def origem_de(caminho: Path) -> str:
    texto = str(caminho).lower()
    if "apmed" in texto:
        return "ApMed Reta Final 2027"
    if "dossi" in texto:
        return "Sprint ENAMED · Dossiê da Banca"
    if "sprint" in texto:
        return "Sprint ENAMED · Provas comentadas"
    if "provas comentadas" in texto:
        return "ENAMED · Provas comentadas"
    return caminho.parent.name or "Material"


def limpar(texto: str) -> str:
    # Quebras soltas no meio da frase viram espaço; linha em branco continua separando parágrafos.
    texto = texto.replace("\r", "")
    texto = re.sub(r"[ \t]+", " ", texto)
    texto = re.sub(r"\n\s*\n+", " ", texto)
    texto = re.sub(r"\s*\n\s*", " ", texto)
    texto = texto.replace(" ", "\n\n")
    return texto.strip()


def trechos_do_arquivo(caminho: Path):
    doc = pymupdf.open(caminho)
    paginas = [(i + 1, limpar(p.get_text())) for i, p in enumerate(doc)]
    atual, inicio, fim = [], None, None
    tamanho = 0
    for numero, texto in paginas:
        if not texto:
            continue
        for paragrafo in texto.split("\n\n"):
            if inicio is None:
                inicio = numero
            atual.append(paragrafo)
            tamanho += len(paragrafo) + 2
            fim = numero
            if tamanho >= TAMANHO:
                yield inicio, fim, "\n\n".join(atual)
                atual, inicio, tamanho = [], None, 0
    if atual and (tamanho >= MINIMO or True):
        yield inicio, fim, "\n\n".join(atual)


def main():
    if not RAIZ.exists():
        sys.exit("Pasta materiais-privados/ não encontrada.")
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    with SAIDA.open("w", encoding="utf-8") as saida:
        for caminho in sorted(RAIZ.rglob("*.pdf")):
            relativo = caminho.relative_to(RAIZ).as_posix()
            n = 0
            for inicio, fim, texto in trechos_do_arquivo(caminho):
                ident = hashlib.sha1(f"{relativo}:{inicio}:{fim}:{n}".encode()).hexdigest()[:20]
                saida.write(json.dumps({
                    "id": ident,
                    "origem": origem_de(caminho),
                    "arquivo": relativo,
                    "pagina_inicio": inicio,
                    "pagina_fim": fim,
                    "texto": texto,
                }, ensure_ascii=False) + "\n")
                n += 1
            total += n
            print(f"{n:5d} trechos  {relativo}")
    print(f"\n{total} trechos gravados em {SAIDA}")


if __name__ == "__main__":
    main()
