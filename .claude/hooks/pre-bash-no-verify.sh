#!/bin/bash
CMD=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)
if echo "$CMD" | grep -qE -- '--no-verify|--no-gpg-sign'; then
  echo "Bloqueado: --no-verify detectado. Hooks de qualidade não podem ser ignorados."
  exit 2
fi
