#!/usr/bin/env python3
"""Sobe as imagens de FDC_UPLOAD para os Arquivos do Shopify via Admin API.

Nao publica nada na loja - apenas hospeda os arquivos (Conteudo -> Arquivos).
Pode rodar de novo: pula o que ja subiu (registra em FDC_uploaded.txt).

Antes de rodar:  pip install requests
E cole seu token de API no campo TOKEN abaixo.
"""

import mimetypes
import os
import sys
import time

try:
    import requests
except ImportError:
    sys.exit("Falta a biblioteca requests. Rode primeiro:  pip install requests")

# ---- CONFIGURACAO ----
SHOP = "fdc-vitamins.myshopify.com"
TOKEN = "COLE_SEU_TOKEN_AQUI"          # token shpat_... do app personalizado
API_VERSION = "2024-10"
UPLOAD_DIR = r"C:\Users\Fernando\FDC_UPLOAD"
LOG = r"C:\Users\Fernando\FDC_uploaded.txt"
# ----------------------

ENDPOINT = f"https://{SHOP}/admin/api/{API_VERSION}/graphql.json"
HEADERS = {"X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json"}


def gql(query, variables=None):
    """Executa GraphQL com retry para throttling."""
    for tentativa in range(6):
        r = requests.post(ENDPOINT, headers=HEADERS,
                          json={"query": query, "variables": variables or {}}, timeout=60)
        if r.status_code == 429:
            time.sleep(2 * (tentativa + 1))
            continue
        data = r.json()
        erros = data.get("errors")
        if erros and any(e.get("extensions", {}).get("code") == "THROTTLED" for e in erros):
            time.sleep(2 * (tentativa + 1))
            continue
        if erros:
            raise RuntimeError(erros)
        return data["data"]
    raise RuntimeError("Throttled demais; tente de novo mais tarde.")


STAGED = """
mutation($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets { url resourceUrl parameters { name value } }
    userErrors { message }
  }
}"""

CRIAR = """
mutation($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files { fileStatus }
    userErrors { message }
  }
}"""


def enviar(caminho, nome):
    mime = mimetypes.guess_type(nome)[0] or "image/jpeg"
    tam = os.path.getsize(caminho)

    d = gql(STAGED, {"input": [{
        "filename": nome, "mimeType": mime, "resource": "IMAGE",
        "httpMethod": "POST", "fileSize": str(tam),
    }]})
    res = d["stagedUploadsCreate"]
    if res["userErrors"]:
        raise RuntimeError(res["userErrors"])
    alvo = res["stagedTargets"][0]

    form = {p["name"]: p["value"] for p in alvo["parameters"]}
    with open(caminho, "rb") as fp:
        up = requests.post(alvo["url"], data=form,
                           files={"file": (nome, fp, mime)}, timeout=300)
    if up.status_code not in (200, 201, 204):
        raise RuntimeError(f"upload falhou ({up.status_code}): {up.text[:200]}")

    d = gql(CRIAR, {"files": [{"originalSource": alvo["resourceUrl"],
                               "contentType": "IMAGE"}]})
    res = d["fileCreate"]
    if res["userErrors"]:
        raise RuntimeError(res["userErrors"])


def main():
    if TOKEN.startswith("COLE_"):
        sys.exit("Cole seu token de API no campo TOKEN do script.")
    if not os.path.isdir(UPLOAD_DIR):
        sys.exit(f"Pasta nao encontrada: {UPLOAD_DIR}")

    feitos = set()
    if os.path.exists(LOG):
        with open(LOG, encoding="utf-8") as f:
            feitos = {l.strip() for l in f if l.strip()}

    arquivos = sorted(n for n in os.listdir(UPLOAD_DIR)
                      if n.lower().endswith((".jpg", ".jpeg", ".png")))
    total = len(arquivos)
    print(f"{total} imagens. {len(feitos)} ja enviadas antes.\n")

    ok = erros = 0
    with open(LOG, "a", encoding="utf-8") as log:
        for i, nome in enumerate(arquivos, 1):
            if nome in feitos:
                continue
            try:
                enviar(os.path.join(UPLOAD_DIR, nome), nome)
                log.write(nome + "\n")
                log.flush()
                ok += 1
            except Exception as e:
                erros += 1
                print(f"\n  erro em {nome}: {str(e)[:160]}")
            print(f"\r[{i * 100 // total:3d}%] {i}/{total}  novos={ok} erros={erros}",
                  end="", flush=True)
            time.sleep(0.3)

    print(f"\n\nConcluido! {ok} enviadas, {erros} erros.")
    print("As imagens estao em Conteudo -> Arquivos (nao aparecem na loja).")


if __name__ == "__main__":
    main()
