#!/usr/bin/env python3
"""Otimiza imagens (jpg/png) das pastas escolhidas para uso na web.

Redimensiona para no maximo MAX_PX no lado maior e salva como JPEG (ou PNG
se tiver transparencia) em DESTINO_DIR, preservando a estrutura de pastas.
Mostra progresso e pode ser executado de novo (pula o que ja foi feito).
"""

import os
import sys

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow nao instalado. Rode primeiro:  pip install pillow")

# Libera imagens muito grandes (ex.: expositores em alta) sem alerta de "bomba"
Image.MAX_IMAGE_PIXELS = None

ORIGEM = r"M:\02 - FDC"
PASTAS = ["MOKCUPS_FDC", "MATERIAL DIGITAL", "PRODUTOS FDC", "Produtos PT",
          "NEW", "LÂMINAS", "SLIDES NUTRI", "SITE"]
DESTINO_DIR = r"C:\Users\Fernando\FDC_IMAGENS_WEB"
MAX_PX = 1920
QUALIDADE = 82
EXTS = (".jpg", ".jpeg", ".png")


def coletar():
    arquivos = []
    for p in PASTAS:
        raiz = os.path.join(ORIGEM, p)
        if not os.path.isdir(raiz):
            print(f"  (pasta nao encontrada, pulando: {raiz})")
            continue
        for pasta, _, nomes in os.walk(raiz):
            for nome in nomes:
                if nome.lower().endswith(EXTS):
                    arquivos.append(os.path.join(pasta, nome))
    return arquivos


def main():
    os.makedirs(DESTINO_DIR, exist_ok=True)
    print("Procurando imagens...")
    arquivos = coletar()
    total = len(arquivos)
    if not total:
        sys.exit("Nenhuma imagem encontrada.")
    print(f"{total} imagens. Otimizando para no maximo {MAX_PX}px...\n")

    base = os.path.dirname(ORIGEM.rstrip("\\/")) or ORIGEM
    ok = pulados = erros = 0
    for i, caminho in enumerate(arquivos, 1):
        rel = os.path.relpath(caminho, base)
        destino = os.path.join(DESTINO_DIR, rel)
        sem_ext = os.path.splitext(destino)[0]
        jpg, png = sem_ext + ".jpg", sem_ext + ".png"

        if os.path.exists(jpg) or os.path.exists(png):
            pulados += 1
        else:
            os.makedirs(os.path.dirname(destino), exist_ok=True)
            try:
                with Image.open(caminho) as im:
                    im = ImageOps.exif_transpose(im)
                    im.thumbnail((MAX_PX, MAX_PX))
                    tem_alpha = im.mode in ("RGBA", "LA") or (
                        im.mode == "P" and "transparency" in im.info)
                    if tem_alpha:
                        im.save(png, "PNG", optimize=True)
                    else:
                        im.convert("RGB").save(jpg, "JPEG",
                                               quality=QUALIDADE, optimize=True)
                ok += 1
            except Exception as e:
                erros += 1
                print(f"\n  erro em {rel}: {e}")

        pct = i * 100 // total
        print(f"\r[{pct:3d}%] {i}/{total}  novos={ok} pulados={pulados} erros={erros}",
              end="", flush=True)

    soma = 0
    for pasta, _, nomes in os.walk(DESTINO_DIR):
        for n in nomes:
            try:
                soma += os.path.getsize(os.path.join(pasta, n))
            except OSError:
                pass
    print(f"\n\nConcluido! Imagens em: {DESTINO_DIR}")
    print(f"Tamanho total otimizado: {soma / 1024 ** 3:.2f} GB")


if __name__ == "__main__":
    main()
