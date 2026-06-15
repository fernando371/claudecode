#!/usr/bin/env python3
"""Sobe as imagens de FDC_UPLOAD para o Cloudinary (CDN gratuito) e gera um
manifesto com as URLs publicas de cada imagem.

Nao depende do Shopify. Pode rodar de novo: pula o que ja subiu (FDC_cloudinary_log.csv).

Antes de rodar:  pip install cloudinary
E preencha CLOUD_NAME, API_KEY e API_SECRET (estao no painel do Cloudinary).
"""

import csv
import os
import sys

try:
    import cloudinary
    import cloudinary.uploader
except ImportError:
    sys.exit("Falta a biblioteca cloudinary. Rode primeiro:  pip install cloudinary")

# ---- CONFIGURACAO (pegue no painel do Cloudinary) ----
CLOUD_NAME = "SEU_CLOUD_NAME"
API_KEY = "SUA_API_KEY"
API_SECRET = "SUA_API_SECRET"
# ------------------------------------------------------

ORIGEM = r"C:\Users\Fernando\FDC_UPLOAD"
LOG = r"C:\Users\Fernando\FDC_cloudinary_log.csv"
SAIDA = r"C:\Users\Fernando\FDC_manifest_urls.csv"

cloudinary.config(cloud_name=CLOUD_NAME, api_key=API_KEY,
                  api_secret=API_SECRET, secure=True)


def main():
    if "SEU_" in CLOUD_NAME or "SUA_" in API_KEY or "SUA_" in API_SECRET:
        sys.exit("Preencha CLOUD_NAME, API_KEY e API_SECRET no topo do script.")
    if not os.path.isdir(ORIGEM):
        sys.exit(f"Pasta nao encontrada: {ORIGEM}")

    feitos = {}
    if os.path.exists(LOG):
        with open(LOG, encoding="utf-8") as f:
            for row in csv.reader(f):
                if len(row) >= 2:
                    feitos[row[0]] = row[1]

    arquivos = sorted(n for n in os.listdir(ORIGEM)
                      if n.lower().endswith((".jpg", ".jpeg", ".png")))
    total = len(arquivos)
    print(f"{total} imagens. {len(feitos)} ja enviadas antes.\n")

    ok = erros = 0
    with open(LOG, "a", newline="", encoding="utf-8") as logf:
        log = csv.writer(logf)
        for i, nome in enumerate(arquivos, 1):
            if nome not in feitos:
                base = os.path.splitext(nome)[0]
                folder = "fdc/" + (base.split("__")[0] if "__" in base else "geral")
                try:
                    res = cloudinary.uploader.upload(
                        os.path.join(ORIGEM, nome),
                        folder=folder, public_id=base,
                        overwrite=False, resource_type="image")
                    feitos[nome] = res["secure_url"]
                    log.writerow([nome, res["secure_url"]])
                    logf.flush()
                    ok += 1
                except Exception as e:
                    erros += 1
                    print(f"\n  erro em {nome}: {str(e)[:160]}")
            print(f"\r[{i * 100 // total:3d}%] {i}/{total}  novos={ok} erros={erros}",
                  end="", flush=True)

    with open(SAIDA, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["arquivo", "categoria", "url"])
        for nome in arquivos:
            base = os.path.splitext(nome)[0]
            cat = base.split("__")[0] if "__" in base else "geral"
            w.writerow([nome, cat, feitos.get(nome, "")])

    print(f"\n\nConcluido! {ok} novas enviadas, {erros} erros.")
    print(f"Manifesto com URLs: {SAIDA}")


if __name__ == "__main__":
    main()
