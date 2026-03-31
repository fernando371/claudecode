#!/bin/bash
# Hook PostToolUse: loga comandos Bash executados em .claude/bash-log.md

LOG=".claude/bash-log.md"

python3 -c "
import json, sys
from datetime import datetime

data   = json.load(sys.stdin)
ti     = data.get('tool_input', {})
tr     = data.get('tool_response', {})
cmd    = ti.get('command', '').strip()
stderr = tr.get('stderr', '') if isinstance(tr, dict) else ''
stdout = tr.get('stdout', '') if isinstance(tr, dict) else ''

if not cmd:
    sys.exit(0)

status = 'ERRO' if stderr and not stdout else 'OK'
ts     = datetime.now().strftime('%H:%M:%S')
short  = cmd[:120].replace('|', '\|')
print(f'| {ts} | {status} | \`{short}\` |')
" >> "$LOG" 2>/dev/null || true
