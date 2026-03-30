#!/bin/bash
# Hook pós-edição: verifica sintaxe e gera resumo curto

FILE=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)
if [ -z "$FILE" ]; then
  exit 0
fi

EXT="${FILE##*.}"

# Verificação de sintaxe por tipo
case "$EXT" in
  py)
    python3 -m py_compile "$FILE" 2>&1 && echo "[OK] $FILE sem erros de sintaxe" || echo "[ERRO] $FILE falhou na verificação"
    ;;
  js)
    node --check "$FILE" 2>&1 && echo "[OK] $FILE sem erros de sintaxe" || echo "[ERRO] $FILE falhou na verificação"
    ;;
  ts)
    echo "[INFO] .ts requer tsc — verificação de sintaxe ignorada"
    ;;
  sh)
    bash -n "$FILE" 2>&1 && echo "[OK] $FILE sem erros de sintaxe" || echo "[ERRO] $FILE falhou na verificação"
    ;;
  *)
    echo "[INFO] Sem verificador para .$EXT"
    ;;
esac

echo "[RESUMO] Arquivo editado: $FILE | $(date '+%H:%M:%S')"
