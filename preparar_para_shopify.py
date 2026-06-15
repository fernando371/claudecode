#!/usr/bin/env python3
"""Prepara as imagens otimizadas para subir no Shopify Arquivos.

1) Copia tudo para uma pasta unica (FDC_UPLOAD) com nomes unicos e limpos
   (sem espaco/acento), prefixados pela categoria -> upload em massa sem
   conflito de nome.
2) Gera um manifesto CSV (nome novo, categoria, caminho original).
3) Gera contact sheets (folhas de miniaturas) por categoria para o agente
   escolher visualmente.
Pode rodar de novo (pula o que ja existe).
"""

import csv
import os
import shutil
import sys
import unicodedata

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow nao instalado. Rode primeiro:  pip install pillow")

Image.MAX_IMAGE_PIXELS = None

ORIGEM = r"C:\Users\Fernando\FDC_IMAGENS_WEB"
UPLOAD_DIR = r"C:\Users\Fernando\FDC_UPLOAD"
SHEETS_DIR = r"C:\Users\Fernando\FDC_CONTACT_SHEETS"
MANIFEST = r"C:\Users\Fernando\FDC_manifest.csv"
EXTS = (".jpg", ".jpeg", ".png")

COLS = 4
LINHAS = 5          # 20 imagens por folha
THUMB = 360
LABEL_H = 46
MARGEM = 10


def sanitizar(texto):
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    s = "".join(ch if (ch.isalnum() or ch in "._-") else "_" for ch in t)
    while "__" in s:
        s = s.replace("__", "_")
    return s.strip("_") or "img"


def categoria_de(rel):
    partes = rel.split(os.sep)
    if partes and partes[0] == "02 - FDC" and len(partes) > 1:
        return partes[1]
    return partes[0] if partes else "GERAL"


def carregar_fonte(tam):
    for nome in ("arial.ttf", "segoeui.ttf", "calibri.ttf"):
        try:
            return ImageFont.truetype(nome, tam)
        except OSError:
            continue
    return ImageFont.load_default()


def fase_copiar():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    usados = set(os.listdir(UPLOAD_DIR))
    arquivos = []
    for pasta, _, nomes in os.walk(ORIGEM):
        for nome in nomes:
            if nome.lower().endswith(EXTS):
                arquivos.append(os.path.join(pasta, nome))
    total = len(arquivos)
    print(f"{total} imagens. Preparando para upload...\n")

    linhas = []
    for i, origem in enumerate(arquivos, 1):
        rel = os.path.relpath(origem, ORIGEM)
        cat = categoria_de(rel)
        base, ext = os.path.splitext(os.path.basename(origem))
        prefixo = f"{sanitizar(cat)}__{sanitizar(base)}"
        novo = f"{prefixo}{ext.lower()}"
        k = 2
        while novo in usados:
            novo = f"{prefixo}_{k}{ext.lower()}"
            k += 1
        usados.add(novo)
        destino = os.path.join(UPLOAD_DIR, novo)
        if not os.path.exists(destino):
            shutil.copy2(origem, destino)
        linhas.append((novo, cat, rel))
        if i % 100 == 0 or i == total:
            print(f"\r  {i}/{total}", end="", flush=True)
    print()

    with open(MANIFEST, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["arquivo", "categoria", "caminho_original"])
        w.writerows(linhas)
    print(f"Manifesto: {MANIFEST}  ({len(linhas)} itens)")
    return linhas


def fase_contact_sheets(linhas):
    os.makedirs(SHEETS_DIR, exist_ok=True)
    fonte = carregar_fonte(15)
    grupos = {}
    for novo, cat, _ in linhas:
        grupos.setdefault(cat, []).append(novo)

    por_folha = COLS * LINHAS
    cell_w = THUMB + MARGEM
    cell_h = THUMB + LABEL_H + MARGEM
    largura = COLS * cell_w + MARGEM
    altura = LINHAS * cell_h + MARGEM

    for cat, itens in sorted(grupos.items()):
        itens.sort()
        n_folhas = (len(itens) + por_folha - 1) // por_folha
        for folha in range(n_folhas):
            sheet = Image.new("RGB", (largura, altura), "white")
            d = ImageDraw.Draw(sheet)
            bloco = itens[folha * por_folha:(folha + 1) * por_folha]
            for idx, nome in enumerate(bloco):
                col, lin = idx % COLS, idx // COLS
                x = MARGEM + col * cell_w
                y = MARGEM + lin * cell_h
                try:
                    with Image.open(os.path.join(UPLOAD_DIR, nome)) as im:
                        im = im.convert("RGB")
                        im.thumbnail((THUMB, THUMB))
                        sheet.paste(im, (x + (THUMB - im.width) // 2,
                                         y + (THUMB - im.height) // 2))
                except Exception:
                    pass
                rotulo = nome if len(nome) <= 48 else nome[:45] + "..."
                d.text((x, y + THUMB + 4), rotulo, fill="black", font=fonte)
            saida = os.path.join(SHEETS_DIR, f"{sanitizar(cat)}_{folha + 1:02d}.jpg")
            sheet.save(saida, "JPEG", quality=75)
            print(f"  contact sheet: {os.path.basename(saida)}")


def main():
    if not os.path.isdir(ORIGEM):
        sys.exit(f"Pasta nao encontrada: {ORIGEM}")
    linhas = fase_copiar()
    print("\nGerando contact sheets...")
    fase_contact_sheets(linhas)
    print("\nConcluido!")
    print(f"  - Imagens para upload no Shopify: {UPLOAD_DIR}")
    print(f"  - Manifesto (CSV): {MANIFEST}")
    print(f"  - Contact sheets: {SHEETS_DIR}")


if __name__ == "__main__":
    main()
