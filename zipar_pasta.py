#!/usr/bin/env python3
"""Compacta uma pasta em varios .zip de tamanho limitado (ZIP64).

Mostra progresso, tenta de novo em falhas de rede e pode ser executado
de novo para continuar de onde parou (partes ja prontas sao puladas).
"""

import os
import sys
import time
import zipfile

# Ajuste estes valores conforme necessario
PASTA_ORIGEM = r"M:\02 - FDC"
DESTINO_DIR = r"M:\FDC_ZIP"          # pasta onde os zips serao salvos
PREFIXO = "FDC TUDO - parte"
TAMANHO_MAX_GB = 4                    # tamanho aproximado de cada zip

# Arquivos temporarios a ignorar (case-insensitive)
IGNORAR = {"thumbs.db", ".ds_store", "desktop.ini"}

# Compressao: STORED = sem compressao (mais rapido, ideal p/ imagens/PDF)
COMPRESSAO = zipfile.ZIP_STORED

TENTATIVAS = 5    # quantas vezes tentar de novo se a rede cair
ESPERA = 5        # segundos entre tentativas


def listar_arquivos(raiz):
    arquivos = []
    for pasta, _, nomes in os.walk(raiz):
        for nome in nomes:
            if nome.lower() in IGNORAR:
                continue
            caminho = os.path.join(pasta, nome)
            try:
                tam = os.path.getsize(caminho)
            except OSError:
                tam = 0
            arquivos.append((caminho, tam))
    return arquivos


def dividir_em_partes(arquivos, limite_bytes):
    partes = []
    atual = []
    soma = 0
    for caminho, tam in arquivos:
        if atual and soma + tam > limite_bytes:
            partes.append(atual)
            atual = []
            soma = 0
        atual.append((caminho, tam))
        soma += tam
    if atual:
        partes.append(atual)
    return partes


def gravar_parte(arquivos, base, destino_final):
    destino_tmp = destino_final + ".tmp"
    kwargs = {"compression": COMPRESSAO, "allowZip64": True}
    with zipfile.ZipFile(destino_tmp, "w", **kwargs) as zf:
        total = len(arquivos)
        for i, (caminho, _) in enumerate(arquivos, 1):
            arcname = os.path.relpath(caminho, base)
            zf.write(caminho, arcname)
            pct = i * 100 // total
            print(f"\r    [{pct:3d}%] {i}/{total}  {arcname[:50]:<50}",
                  end="", flush=True)
    os.replace(destino_tmp, destino_final)
    print()


def main():
    if not os.path.isdir(PASTA_ORIGEM):
        sys.exit(f"Pasta de origem nao encontrada: {PASTA_ORIGEM}")
    os.makedirs(DESTINO_DIR, exist_ok=True)

    print("Lendo lista de arquivos...")
    arquivos = listar_arquivos(PASTA_ORIGEM)
    if not arquivos:
        sys.exit("Nenhum arquivo para compactar.")

    limite = int(TAMANHO_MAX_GB * 1024 ** 3)
    partes = dividir_em_partes(arquivos, limite)
    base = os.path.dirname(PASTA_ORIGEM.rstrip("\\/")) or PASTA_ORIGEM
    n = len(partes)
    print(f"{len(arquivos)} arquivos -> {n} zip(s) de ate {TAMANHO_MAX_GB} GB\n")

    for idx, parte in enumerate(partes, 1):
        destino = os.path.join(DESTINO_DIR, f"{PREFIXO} {idx:02d} de {n:02d}.zip")
        if os.path.exists(destino):
            print(f"Parte {idx}/{n} ja existe, pulando: {os.path.basename(destino)}")
            continue
        print(f"Parte {idx}/{n} -> {os.path.basename(destino)}")
        for tentativa in range(1, TENTATIVAS + 1):
            try:
                gravar_parte(parte, base, destino)
                break
            except OSError as e:
                tmp = destino + ".tmp"
                if os.path.exists(tmp):
                    try:
                        os.remove(tmp)
                    except OSError:
                        pass
                if tentativa == TENTATIVAS:
                    sys.exit(f"\nFalhou na parte {idx} apos {TENTATIVAS} tentativas: {e}")
                print(f"\n    Erro ({e}). Tentativa {tentativa}/{TENTATIVAS}. "
                      f"Esperando {ESPERA}s e tentando de novo...")
                time.sleep(ESPERA)

    print(f"\nConcluido! Zips salvos em: {DESTINO_DIR}")


if __name__ == "__main__":
    main()
