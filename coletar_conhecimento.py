#!/usr/bin/env python3
"""Coleta os arquivos de CONHECIMENTO da marca (PDF, texto, docx...) para
subir como base de conhecimento no Claude.ai.

Copia de M:\\02 - FDC tudo que o Claude consegue ler, ignora binarios
pesados (psd, ai, pptx, imagens) e arquivos acima de MAX_MB. Preserva a
estrutura de pastas e mostra o que foi coletado.
"""

import os
import shutil
import sys

ORIGEM = r"M:\02 - FDC"
DESTINO_DIR = r"C:\Users\Fernando\FDC_CONHECIMENTO"
EXTS = (".pdf", ".txt", ".docx", ".doc", ".md", ".csv", ".rtf")
MAX_MB = 30  # Claude.ai aceita ate ~30 MB por arquivo

IGNORAR = {"thumbs.db", ".ds_store", "desktop.ini"}


def main():
    if not os.path.isdir(ORIGEM):
        sys.exit(f"Pasta de origem nao encontrada: {ORIGEM}")
    os.makedirs(DESTINO_DIR, exist_ok=True)
    base = os.path.dirname(ORIGEM.rstrip("\\/")) or ORIGEM

    copiados = grandes = 0
    soma = 0
    print("Procurando documentos...\n")
    for pasta, _, nomes in os.walk(ORIGEM):
        for nome in nomes:
            if nome.lower() in IGNORAR:
                continue
            if not nome.lower().endswith(EXTS):
                continue
            origem = os.path.join(pasta, nome)
            try:
                tam = os.path.getsize(origem)
            except OSError:
                continue
            if tam > MAX_MB * 1024 * 1024:
                grandes += 1
                print(f"  (grande demais, pulando: {nome} - {tam/1024**2:.0f} MB)")
                continue
            rel = os.path.relpath(origem, base)
            destino = os.path.join(DESTINO_DIR, rel)
            os.makedirs(os.path.dirname(destino), exist_ok=True)
            if not os.path.exists(destino):
                shutil.copy2(origem, destino)
            copiados += 1
            soma += tam
            print(f"  + {rel}")

    print(f"\nConcluido! {copiados} arquivos ({soma/1024**2:.1f} MB) em: {DESTINO_DIR}")
    if grandes:
        print(f"{grandes} arquivo(s) ignorado(s) por passar de {MAX_MB} MB.")


if __name__ == "__main__":
    main()
