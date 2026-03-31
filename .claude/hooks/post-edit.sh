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
  ts|tsx)
    # Procura tsconfig subindo até 3 níveis a partir do arquivo
    DIR=$(dirname "$FILE")
    TSCONFIG=""
    for i in 1 2 3; do
      if [ -f "$DIR/tsconfig.json" ]; then
        TSCONFIG="$DIR/tsconfig.json"
        break
      fi
      DIR=$(dirname "$DIR")
    done
    if [ -n "$TSCONFIG" ]; then
      tsc --noEmit -p "$TSCONFIG" 2>&1 | head -20 && echo "[OK] $FILE sem erros de tipo" || echo "[ERRO] $FILE falhou na verificação de tipos"
    else
      echo "[INFO] tsconfig.json não encontrado — verificação de tipo ignorada para $FILE"
    fi
    ;;
  sh)
    bash -n "$FILE" 2>&1 && echo "[OK] $FILE sem erros de sintaxe" || echo "[ERRO] $FILE falhou na verificação"
    ;;
  *)
    echo "[INFO] Sem verificador para .$EXT"
    ;;
esac

echo "[RESUMO] Arquivo editado: $FILE | $(date '+%H:%M:%S')"
