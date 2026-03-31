#!/bin/bash
# Hook Stop: registra fim de sessão em .claude/session-log.md

LOG=".claude/session-log.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

python3 -c "
import json, sys

data = json.load(sys.stdin)
stop_reason = data.get('stop_reason', 'unknown')
total_cost   = data.get('total_cost_usd')
usage        = data.get('usage', {})

lines = []
lines.append('## Sessão $TIMESTAMP')
lines.append(f'- Motivo de parada: {stop_reason}')
if total_cost is not None:
    lines.append(f'- Custo total: USD {total_cost:.4f}')
if usage:
    inp  = usage.get('input_tokens', '?')
    out  = usage.get('output_tokens', '?')
    cache_read  = usage.get('cache_read_input_tokens', 0)
    cache_write = usage.get('cache_creation_input_tokens', 0)
    lines.append(f'- Tokens entrada: {inp} | saída: {out}')
    if cache_read or cache_write:
        lines.append(f'- Cache lido: {cache_read} | criado: {cache_write}')
    if isinstance(inp, int) and inp > 80000:
        lines.append(f'- ⚠ Contexto alto ({inp} tokens entrada). Use /compact antes da próxima sessão.')

lines.append('')

print('\n'.join(lines))
" >> "$LOG" 2>/dev/null || true
