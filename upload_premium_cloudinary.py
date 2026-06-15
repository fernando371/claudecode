#!/usr/bin/env python3
"""Sobe a SELECAO PREMIUM curada para o Cloudinary em pastas limpas
(fdc_premium/<categoria>) e gera um manifesto enxuto FDC_PREMIUM_urls.csv
com: categoria_final, arquivo, url.

Pula a pasta 99 (descarte). Pode rodar de novo (resume via log).

Antes:  pip install cloudinary
Use a API key NOVA se voce rotacionou a antiga (a antiga foi exposta no chat).
"""

import csv
import os
import sys

try:
    import cloudinary
    import cloudinary.uploader
except ImportError:
    sys.exit("Falta cloudinary. Rode:  pip install cloudinary")

# ---- CONFIG (cloud_name e api_key nao sao secretos; o SECRET sim) ----
CLOUD_NAME = "di7l5astl"
API_KEY = "777121844593372"
API_SECRET = "COLE_SEU_SECRET_AQUI"   # use a NOVA chave se rotacionou
# ----------------------------------------------------------------------

ORIGEM = r"C:\Users\Fernando\FDC_CURADORIA_ESSENTIAL_PREMIUM_REVISADA"
SAIDA = r"C:\Users\Fernando\FDC_PREMIUM_urls.csv"
LOG = r"C:\Users\Fernando\FDC_premium_log.csv"
PULAR_PREFIXO = "99"   # nao sobe a pasta de descarte

cloudinary.config(cloud_name=CLOUD_NAME, api_key=API_KEY,
                  api_secret=API_SECRET, secure=True)


def main():
    if "COLE_" in API_SECRET:
        sys.exit("Cole seu API Secret do Cloudinary no campo API_SECRET.")
    if not os.path.isdir(ORIGEM):
        sys.exit(f"Pasta nao encontrada: {ORIGEM}\nRode curar_premium.py antes.")

    feitos = {}
    if os.path.exists(LOG):
        with open(LOG, encoding="utf-8") as f:
            for row in csv.reader(f):
                if len(row) >= 2:
                    feitos[row[0]] = row[1]

    arquivos = []
    for pasta, _, nomes in os.walk(ORIGEM):
        for nome in nomes:
            if nome.lower().endswith((".jpg", ".jpeg", ".png")):
                rel = os.path.relpath(os.path.join(pasta, nome), ORIGEM)
                cat = rel.split(os.sep)[0]            # subpasta de topo = categoria
                if cat.startswith(PULAR_PREFIXO):
                    continue
                arquivos.append((os.path.join(pasta, nome), nome, cat))
    total = len(arquivos)
    if total == 0:
        sys.exit("Nada para subir (rode a curadoria primeiro).")
    print(f"{total} imagens premium. {len(feitos)} ja enviadas antes.\n")

    ok = erros = 0
    registros = []
    with open(LOG, "a", newline="", encoding="utf-8") as logf:
        log = csv.writer(logf)
        for i, (caminho, nome, cat) in enumerate(arquivos, 1):
            chave = f"{cat}/{nome}"
            if chave in feitos:
                registros.append((cat, nome, feitos[chave]))
            else:
                base = os.path.splitext(nome)[0]
                folder = "fdc_premium/" + cat
                try:
                    res = cloudinary.uploader.upload(
                        caminho, folder=folder, public_id=base,
                        overwrite=False, resource_type="image")
                    url = res["secure_url"]
                    feitos[chave] = url
                    registros.append((cat, nome, url))
                    log.writerow([chave, url])
                    logf.flush()
                    ok += 1
                except Exception as e:
                    erros += 1
                    print(f"\n  erro em {chave}: {str(e)[:160]}")
            print(f"\r[{i * 100 // total:3d}%] {i}/{total}  novos={ok} erros={erros}",
                  end="", flush=True)

    with open(SAIDA, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["categoria_final", "arquivo", "url"])
        for cat, nome, url in registros:
            w.writerow([cat, nome, url])

    print(f"\n\nConcluido! {ok} novas, {erros} erros.")
    print(f"Manifesto premium: {SAIDA}")


if __name__ == "__main__":
    main()
