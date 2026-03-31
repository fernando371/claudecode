#!/bin/bash
# Hook PreToolUse: guarda operações destrutivas via MCP GitHub
# Cobre: push_files, create_or_update_file, delete_file, merge_pull_request

python3 -c "
import json, sys, re

data = json.load(sys.stdin)
tool = data.get('tool_name', '')
ti   = data.get('tool_input', {})

PROTECTED_BRANCHES = {'main', 'master', 'develop', 'production', 'release'}

msg = None

if tool == 'mcp__github__push_files':
    branch = ti.get('branch', '')
    files  = ti.get('files', [])
    if branch.lower() in PROTECTED_BRANCHES:
        msg = f'[github-guard] Push direto para branch protegida: {branch!r}. Confirme se isso é intencional.'
    elif not branch:
        msg = '[github-guard] Push sem branch especificada. Defina a branch de destino antes de prosseguir.'
    elif len(files) > 10:
        msg = f'[github-guard] Push de {len(files)} arquivos de uma vez. Verifique o escopo antes de prosseguir.'

elif tool == 'mcp__github__create_or_update_file':
    branch = ti.get('branch', '')
    path   = ti.get('path', '')
    if branch.lower() in PROTECTED_BRANCHES:
        msg = f'[github-guard] Escrita direta em branch protegida: {branch!r} → {path!r}. Confirme se isso é intencional.'

elif tool == 'mcp__github__delete_file':
    branch = ti.get('branch', '')
    path   = ti.get('path', '')
    if branch.lower() in PROTECTED_BRANCHES:
        msg = f'[github-guard] Deleção em branch protegida: {branch!r} → {path!r}. Confirme se isso é intencional.'
    else:
        msg = f'[github-guard] Deleção de arquivo remoto: {path!r} em {branch!r}. Operação irreversível — confirme.'

elif tool == 'mcp__github__merge_pull_request':
    pr     = ti.get('pullRequestNumber') or ti.get('pull_number', '?')
    method = ti.get('mergeMethod', 'merge')
    msg = f'[github-guard] Merge do PR #{pr} via {method!r}. Confirme se os checks passaram e o PR está pronto.'

if msg:
    print(json.dumps({'systemMessage': msg}))
"
