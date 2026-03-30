#!/bin/bash
# Hook pós-edição: verifica sintaxe e gera resumo curto

FILE="$1"

if [ -z "$FILE" ]; then
  exit 0
fi

EXT="${FILE##*.}"

# Verificação de sintaxe por tipo
case "$EXT" in
  py)
    python3 -m py_compile "$FILE" 2>&1 && echo "[OK] $FILE sem erros de sintaxe" || echo "[ERRO] $FILE falhou na verificação"
    ;;
  js|ts)
    node --check "$FILE" 2>&1 && echo "[OK] $FILE sem erros de sintaxe" || echo "[ERRO] $FILE falhou na verificação"
    ;;
  sh)
    bash -n "$FILE" 2>&1 && echo "[OK] $FILE sem erros de sintaxe" || echo "[ERRO] $FILE falhou na verificação"
    ;;
  *)
    echo "[INFO] Sem verificador para .$EXT"
    ;;
esac

echo "[RESUMO] Arquivo editado: $FILE | $(date '+%H:%M:%S')"
