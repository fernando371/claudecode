#!/usr/bin/env python3
"""Compacta a pasta de imagens otimizadas em varios .zip pequenos (ZIP64).

Cada zip tem ate MAX_MB. Mostra progresso e pode rodar de novo (pula
as partes ja prontas).
"""

import os
import sys
import zipfile

ORIGEM = r"C:\Users\Fernando\FDC_IMAGENS_WEB"
DESTINO_DIR = r"C:\Users\Fernando\FDC_IMAGENS_ZIP"
PREFIXO = "FDC IMAGENS - parte"
MAX_MB = 250

COMPRESSAO = zipfile.ZIP_STORED


def listar(raiz):
    arquivos = []
    for pasta, _, nomes in os.walk(raiz):
        for nome in nomes:
            caminho = os.path.join(pasta, nome)
            try:
                tam = os.path.getsize(caminho)
            except OSError:
                tam = 0
            arquivos.append((caminho, tam))
    return arquivos


def dividir(arquivos, limite):
    partes, atual, soma = [], [], 0
    for c, t in arquivos:
        if atual and soma + t > limite:
            partes.append(atual)
            atual, soma = [], 0
        atual.append((c, t))
        soma += t
    if atual:
        partes.append(atual)
    return partes


def gravar(arquivos, base, destino):
    tmp = destino + ".tmp"
    with zipfile.ZipFile(tmp, "w", compression=COMPRESSAO, allowZip64=True) as zf:
        total = len(arquivos)
        for i, (c, _) in enumerate(arquivos, 1):
            zf.write(c, os.path.relpath(c, base))
            pct = i * 100 // total
            print(f"\r    [{pct:3d}%] {i}/{total}", end="", flush=True)
    os.replace(tmp, destino)
    print()


def main():
    if not os.path.isdir(ORIGEM):
        sys.exit(f"Pasta nao encontrada: {ORIGEM}")
    os.makedirs(DESTINO_DIR, exist_ok=True)
    arquivos = listar(ORIGEM)
    if not arquivos:
        sys.exit("Nenhum arquivo.")
    partes = dividir(arquivos, MAX_MB * 1024 * 1024)
    n = len(partes)
    print(f"{len(arquivos)} arquivos -> {n} zip(s) de ate {MAX_MB} MB\n")
    for idx, parte in enumerate(partes, 1):
        destino = os.path.join(DESTINO_DIR, f"{PREFIXO} {idx:02d} de {n:02d}.zip")
        if os.path.exists(destino):
            print(f"Parte {idx}/{n} ja existe, pulando.")
            continue
        print(f"Parte {idx}/{n} -> {os.path.basename(destino)}")
        gravar(parte, ORIGEM, destino)
    print(f"\nConcluido! Zips em: {DESTINO_DIR}")


if __name__ == "__main__":
    main()
