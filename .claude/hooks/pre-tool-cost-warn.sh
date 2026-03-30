#!/bin/bash
python3 -c '
import json, sys, re

data = json.load(sys.stdin)
tool = data.get("tool_name", "")
ti = data.get("tool_input", {})
warn = False
msg = ""

if tool == "Agent":
    prompt = ti.get("prompt", "")
    if re.search(
        r"cada (arquivo|file)|todos os arquivos|todo o (código|projeto|repositório)|"
        r"ler o projeto|read (every|each) file|every file",
        prompt, re.IGNORECASE
    ):
        warn = True
        msg = "Operação pode gerar custo alto. Restrinja a arquivos ou pastas específicas."

elif tool == "Bash":
    cmd = ti.get("command", "")
    if re.search(r"find\s+\.\s+.*\|\s*(xargs|while|for)|for\s+\w+\s+in\s+\$\(find", cmd):
        warn = True
        msg = "Comando itera sobre muitos arquivos. Verifique o escopo antes de executar."

elif tool == "Glob":
    pattern = ti.get("pattern", "")
    path = ti.get("path", "")
    if re.fullmatch(r"\*\*/\*\.[a-z]+", pattern) and not path:
        warn = True
        msg = "Glob sem diretório base pode retornar muitos arquivos. Considere restringir."

if warn:
    print(json.dumps({"systemMessage": "[cost-warn] " + msg}))
'
