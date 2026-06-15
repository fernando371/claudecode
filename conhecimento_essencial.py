#!/usr/bin/env python3
"""Coleta APENAS o conhecimento essencial da marca FDC para subir no Claude.ai.

Em vez de copiar tudo (rotulos repetidos, versoes antigas, etc.), pega so o
que importa para marca + geracao de textos do site. Resultado pequeno e limpo.
"""

import os
import shutil
import sys

ORIGEM = r"M:\02 - FDC"
DESTINO_DIR = r"C:\Users\Fernando\FDC_CONHECIMENTO_ESSENCIAL"
EXTS = (".pdf", ".txt", ".docx", ".doc", ".md", ".csv", ".rtf")
MAX_MB = 30

# Itens a incluir (relativos a ORIGEM). Pode ser arquivo OU pasta.
INCLUIR = [
    r"Manual da Marca FDC-Biowell.pdf",
    r"01 - Logo FDC\28.08.2019 MANUAL DA MARCA 3871.4 BRAND BOOK-1.pdf",
    r"01 - Logo FDC\3871.4 Manual da Marca FDC Novo.pdf",
    r"PANTONES FAIXAS CATEGORIAS FDC.pdf",
    r"4472.38 Escala de Cores Pantone CMYK RGB.pdf",
    r"MATERIAL DIGITAL\PALETA.txt",
    r"MATERIAL DIGITAL\Produtos Site",
    r"PRODUTOS FDC\SITE",
    r"PRODUTOS FDC\Fichas Técnicas",
    r"SAC",
]


def copiar(origem, base):
    """Copia um arquivo valido, preservando a estrutura relativa a ORIGEM."""
    try:
        tam = os.path.getsize(origem)
    except OSError:
        return 0, 0
    if not origem.lower().endswith(EXTS):
        return 0, 0
    if tam > MAX_MB * 1024 * 1024:
        print(f"  (grande demais, pulando: {os.path.basename(origem)})")
        return 0, 0
    rel = os.path.relpath(origem, base)
    destino = os.path.join(DESTINO_DIR, rel)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    if not os.path.exists(destino):
        shutil.copy2(origem, destino)
    print(f"  + {rel}")
    return 1, tam


def main():
    if not os.path.isdir(ORIGEM):
        sys.exit(f"Pasta de origem nao encontrada: {ORIGEM}")
    os.makedirs(DESTINO_DIR, exist_ok=True)

    copiados = 0
    soma = 0
    print("Coletando conhecimento essencial...\n")
    for item in INCLUIR:
        caminho = os.path.join(ORIGEM, item)
        if os.path.isfile(caminho):
            c, s = copiar(caminho, ORIGEM)
            copiados += c
            soma += s
        elif os.path.isdir(caminho):
            for pasta, _, nomes in os.walk(caminho):
                for nome in nomes:
                    c, s = copiar(os.path.join(pasta, nome), ORIGEM)
                    copiados += c
                    soma += s
        else:
            print(f"  (nao encontrado: {item})")

    print(f"\nConcluido! {copiados} arquivos ({soma/1024**2:.1f} MB) em: {DESTINO_DIR}")


if __name__ == "__main__":
    main()
