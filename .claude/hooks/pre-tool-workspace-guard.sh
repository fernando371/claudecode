#!/bin/bash
# Hook PreToolUse: bloqueia Edit/Write/NotebookEdit fora do diretório de trabalho

python3 -c "
import json, sys, os

data = json.load(sys.stdin)
tool = data.get('tool_name', '')
ti   = data.get('tool_input', {})

if tool not in ('Edit', 'Write', 'NotebookEdit'):
    sys.exit(0)

file_path = ti.get('file_path', '')
if not file_path:
    sys.exit(0)

cwd = os.environ.get('CLAUDE_PROJECT_DIR') or os.getcwd()
real_file = os.path.realpath(os.path.abspath(file_path))
real_cwd  = os.path.realpath(cwd)

if not real_file.startswith(real_cwd + os.sep) and real_file != real_cwd:
    msg = f'[workspace-guard] Arquivo fora do workspace: {file_path!r} (workspace: {real_cwd}). Confirme antes de prosseguir.'
    print(json.dumps({'systemMessage': msg}))
"
