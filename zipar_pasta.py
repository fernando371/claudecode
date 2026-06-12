#!/usr/bin/env python3
"""Compacta recursivamente uma pasta em um único .zip (ZIP64, compressão rápida)."""

import os
import sys
import zipfile

# Ajuste estes caminhos conforme necessário
PASTA_ORIGEM = r"M:\02 - FDC"
ARQUIVO_ZIP = r"M:\02 - FDC.zip"

# Arquivos temporários a ignorar (case-insensitive)
IGNORAR = {"thumbs.db", ".ds_store", "desktop.ini"}

# Compressão: STORED = sem compressão (mais rápido).
# Para compressão leve troque para zipfile.ZIP_DEFLATED com compresslevel=1.
COMPRESSAO = zipfile.ZIP_STORED
NIVEL = None  # use 1 se COMPRESSAO = ZIP_DEFLATED


def listar_arquivos(raiz):
    arquivos = []
    for pasta, _, nomes in os.walk(raiz):
        for nome in nomes:
            if nome.lower() in IGNORAR:
                continue
            arquivos.append(os.path.join(pasta, nome))
    return arquivos


def main():
    if not os.path.isdir(PASTA_ORIGEM):
        sys.exit(f"Pasta de origem não encontrada: {PASTA_ORIGEM}")

    destino_dir = os.path.dirname(ARQUIVO_ZIP)
    if destino_dir and not os.path.isdir(destino_dir):
        os.makedirs(destino_dir, exist_ok=True)

    arquivos = listar_arquivos(PASTA_ORIGEM)
    total = len(arquivos)
    if total == 0:
        sys.exit("Nenhum arquivo para compactar.")

    print(f"Compactando {total} arquivos de {PASTA_ORIGEM}")
    print(f"Destino: {ARQUIVO_ZIP}\n")

    base = os.path.dirname(PASTA_ORIGEM.rstrip("\\/")) or PASTA_ORIGEM

    kwargs = {"compression": COMPRESSAO, "allowZip64": True}
    if NIVEL is not None:
        kwargs["compresslevel"] = NIVEL

    with zipfile.ZipFile(ARQUIVO_ZIP, "w", **kwargs) as zf:
        for i, caminho in enumerate(arquivos, 1):
            # Preserva a estrutura de subpastas relativa à pasta de origem
            arcname = os.path.relpath(caminho, base)
            zf.write(caminho, arcname)
            pct = i * 100 // total
            print(f"\r[{pct:3d}%] {i}/{total}  {arcname[:60]:<60}", end="", flush=True)

    print(f"\n\nConcluído: {ARQUIVO_ZIP}")


if __name__ == "__main__":
    main()
