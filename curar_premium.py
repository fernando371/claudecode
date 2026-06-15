#!/usr/bin/env python3
"""Curadoria premium das imagens de 'Produtos Site' para o tema Essential.

Classifica por REGRAS (nome de pasta/arquivo) em 7 categorias, copia para uma
nova estrutura, e gera: manifesto CSV, resumo CSV, relatorio TXT, galeria HTML
e um ZIP final. NAO deleta nada - so copia.

Limitacao honesta: a classificacao e por nome de pasta/arquivo, nao por analise
visual. Use a GALERIA_PREMIUM_REVISADA.html para o passe final manual (mover o
que quiser entre as pastas).

Antes de rodar:  pip install pillow
"""

import csv
import os
import shutil
import sys
import unicodedata

try:
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
except ImportError:
    Image = None  # dimensoes ficam vazias, mas o script roda

# ---- CONFIG ----
SOURCE = r"C:\Users\Fernando\FDC_IMAGENS_WEB\02 - FDC\MATERIAL DIGITAL\Produtos Site"
OUT = r"C:\Users\Fernando\FDC_CURADORIA_ESSENTIAL_PREMIUM_REVISADA"
EXTS = (".jpg", ".jpeg", ".png")
MIN_KB = 15          # abaixo disso -> baixa prioridade (99)
MIN_DIM = 400        # menor lado abaixo disso -> baixa prioridade (99)
# ----------------

CATS = {
    "01": "01_HERO_E_AMBIENTADAS_PREMIUM",
    "02": "02_GALERIA_PRODUTO_PACKSHOTS",
    "03": "03_IMAGENS_PRODUTO_ALTA",
    "04": "04_APOIO_VISUAL_ECOMMERCE",
    "05": "05_BANNERS_REVISAR_MANUALMENTE",
    "06": "06_TECNICAS_COMPRIMIDOS_TABELAS",
    "99": "99_DESCARTAR_OU_BAIXA_PRIORIDADE",
}
ORDEM = ["01", "02", "03", "04", "05", "06", "99"]


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower()


def classificar(rel):
    """Retorna (codigo, observacao) com base no caminho relativo (pasta+nome)."""
    p = norm(rel)
    if any(k in p for k in ("ambient", "lifestyle", "hero", "institu", "ensaio", "cena")):
        return "01", "sinal de ambientada/hero"
    if any(k in p for k in ("comprimido", "capsula", "tablet", "softgel")):
        return "06", "comprimidos"
    if any(k in p for k in ("tabela", "nutri", "dimens", "dias de uso", "dias_de_uso",
                            "tecnic", "rotulagem", "info ")):
        return "06", "tecnica/tabela"
    if any(k in p for k in ("setinha", "sata", "seta")):
        return "04", "setinhas/apoio"
    if "banner" in p:
        return "05", "banner (texto cravado?) revisar"
    if "alta" in p:
        return "03", "fotos produto ALTA"
    if any(k in p for k in ("1 x 1", "1x1", "frasco", "packshot", "pack shot",
                            "fundo branco", "branco")):
        return "02", "packshot 1x1"
    if any(k in p for k in ("apoio", "comparativo", "explica", "beneficio")):
        return "04", "apoio visual"
    if "site" in p:
        return "02", "imagem de site"
    return "02", "foto de produto (default)"


def dims(caminho):
    if Image is None:
        return None, None
    try:
        with Image.open(caminho) as im:
            return im.width, im.height
    except Exception:
        return None, None


def main():
    if not os.path.isdir(SOURCE):
        sys.exit(f"Pasta de origem nao encontrada:\n  {SOURCE}")
    for c in CATS.values():
        os.makedirs(os.path.join(OUT, c), exist_ok=True)

    # coleta
    arquivos = []
    for pasta, _, nomes in os.walk(SOURCE):
        for nome in nomes:
            if nome.lower().endswith(EXTS):
                arquivos.append(os.path.join(pasta, nome))
    total = len(arquivos)
    if total == 0:
        sys.exit("Nenhuma imagem encontrada na origem.")
    print(f"{total} imagens encontradas. Classificando...\n")

    vistos = set()
    usados = {c: set() for c in CATS}
    linhas = []
    contagem = {c: 0 for c in CATS}

    for i, origem in enumerate(arquivos, 1):
        rel = os.path.relpath(origem, SOURCE)
        sub = os.path.dirname(rel) or "(raiz)"
        nome = os.path.basename(origem)
        try:
            tam = os.path.getsize(origem)
        except OSError:
            tam = 0
        w, h = dims(origem)

        cod, obs = classificar(rel)

        # rebaixa para 99 se duplicata ou pequena/baixa resolucao
        chave = norm(nome)
        if chave in vistos:
            cod, obs = "99", "duplicata de nome"
        elif tam < MIN_KB * 1024:
            cod, obs = "99", f"arquivo pequeno (<{MIN_KB}KB)"
        elif w and h and min(w, h) < MIN_DIM:
            cod, obs = "99", f"baixa resolucao ({w}x{h})"
        vistos.add(chave)

        # nome unico no destino
        cat = CATS[cod]
        novo = nome
        k = 2
        while norm(novo) in usados[cod]:
            base, ext = os.path.splitext(nome)
            novo = f"{base}_{k}{ext}"
            k += 1
        usados[cod].add(norm(novo))

        destino = os.path.join(OUT, cat, novo)
        try:
            shutil.copy2(origem, destino)
        except OSError as e:
            obs += f" | ERRO copia: {e}"

        contagem[cod] += 1
        linhas.append({
            "arquivo_original": nome,
            "categoria_final": cat,
            "subpasta_original": sub,
            "caminho_original": origem,
            "caminho_novo": destino,
            "tamanho_mb": f"{tam / 1024 / 1024:.2f}",
            "dimensoes": f"{w}x{h}" if w else "",
            "observacao": obs,
        })
        if i % 50 == 0 or i == total:
            print(f"\r  {i}/{total}", end="", flush=True)
    print()

    # manifesto
    manifesto = os.path.join(OUT, "manifest_premium_revisado.csv")
    with open(manifesto, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["arquivo_original", "categoria_final",
                                          "subpasta_original", "caminho_original",
                                          "caminho_novo", "tamanho_mb",
                                          "dimensoes", "observacao"])
        w.writeheader()
        w.writerows(linhas)

    # resumo
    resumo = os.path.join(OUT, "resumo_premium_revisado.csv")
    with open(resumo, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["categoria_final", "quantidade"])
        for c in ORDEM:
            w.writerow([CATS[c], contagem[c]])
        w.writerow(["TOTAL", total])

    # relatorio
    rel_txt = os.path.join(OUT, "relatorio_curadoria_premium.txt")
    with open(rel_txt, "w", encoding="utf-8") as f:
        f.write("RELATORIO DE CURADORIA PREMIUM - FDC Vitaminas / tema Essential\n")
        f.write("=" * 64 + "\n\n")
        f.write(f"Imagens analisadas: {total}\n")
        f.write(f"Origem: {SOURCE}\n\n")
        f.write("Contagem por categoria final:\n")
        for c in ORDEM:
            f.write(f"  {CATS[c]}: {contagem[c]}\n")
        f.write("\n--- LEITURA ---\n")
        f.write(
            "Maior valor para o tema Essential:\n"
            "  03_IMAGENS_PRODUTO_ALTA e 02_GALERIA_PRODUTO_PACKSHOTS -> galeria de\n"
            "  PDP, coleccao e cards. Comece por estas.\n\n"
            "Usar com cuidado:\n"
            "  05_BANNERS_REVISAR_MANUALMENTE -> tem texto cravado e visual de\n"
            "  campanha antiga; raramente serve como hero premium.\n"
            "  06_TECNICAS_COMPRIMIDOS_TABELAS -> util DENTRO da PDP (modo de uso,\n"
            "  tabela), nunca como hero.\n"
            "  04_APOIO_VISUAL_ECOMMERCE -> setinhas e apoio; secundario.\n\n"
            "Provavelmente datado:\n"
            "  Tudo em 05 (banners) e itens 99.\n\n"
            "ATENCAO: 01_HERO_E_AMBIENTADAS tende a ficar quase vazio - nao ha\n"
            "fotografia ambientada/lifestyle real neste material. Hero premium\n"
            "depende de ensaio de estudio a produzir.\n\n"
            "Recomendacao de uso no Shopify (ordem):\n"
            "  1) 03_IMAGENS_PRODUTO_ALTA  2) 02_GALERIA_PRODUTO_PACKSHOTS\n"
            "  3) 01 (se houver algo)      4) 06 dentro da PDP\n"
            "  5) 04 como apoio            6) 05 so apos revisao manual\n\n"
            "NOTA: classificacao por nome de pasta/arquivo, nao por analise visual.\n"
            "Use GALERIA_PREMIUM_REVISADA.html para o passe final com o olho.\n"
        )

    # galeria HTML
    html = os.path.join(OUT, "GALERIA_PREMIUM_REVISADA.html")
    porcat = {c: [] for c in CATS}
    for ln in linhas:
        cod = next(k for k, v in CATS.items() if v == ln["categoria_final"])
        porcat[cod].append(ln)
    with open(html, "w", encoding="utf-8") as f:
        f.write("<!doctype html><meta charset='utf-8'><title>Curadoria Premium FDC</title>")
        f.write("<style>body{font-family:Arial;margin:24px;background:#faf8f5}"
                "h2{border-bottom:2px solid #C49261;padding-bottom:6px;margin-top:36px}"
                ".g{display:flex;flex-wrap:wrap;gap:14px}"
                ".c{width:200px;font-size:11px;color:#555;background:#fff;border:1px solid #e4ddd4;"
                "border-radius:8px;padding:8px}"
                ".c img{width:100%;height:160px;object-fit:contain;background:#f0ece6;border-radius:6px}"
                "</style>")
        f.write("<h1>Curadoria Premium - FDC Vitaminas</h1>")
        for c in ORDEM:
            itens = porcat[c]
            f.write(f"<h2>{CATS[c]} ({len(itens)})</h2><div class='g'>")
            for ln in itens:
                src = f"{CATS[c]}/{os.path.basename(ln['caminho_novo'])}"
                f.write(f"<div class='c'><img loading='lazy' src='{src}'>"
                        f"<b>{ln['arquivo_original']}</b><br>{ln['subpasta_original']}<br>"
                        f"{ln['tamanho_mb']} MB · {ln['dimensoes']}<br>"
                        f"<i>{ln['observacao']}</i></div>")
            f.write("</div>")

    # zip
    print("\nGerando ZIP...")
    zip_base = OUT  # shutil acrescenta .zip
    if os.path.exists(OUT + ".zip"):
        os.remove(OUT + ".zip")
    shutil.make_archive(zip_base, "zip", OUT)

    print("\nConcluido!")
    for c in ORDEM:
        print(f"  {CATS[c]}: {contagem[c]}")
    print(f"\nPasta final: {OUT}")
    print(f"ZIP final:   {OUT}.zip")
    print(f"Galeria:     {html}")


if __name__ == "__main__":
    main()
