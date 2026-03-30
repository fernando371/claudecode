#!/bin/bash
python3 -c '
import json, sys, re

data = json.load(sys.stdin)
tool = data.get("tool_name", "")
ti = data.get("tool_input", {})
broad = False
msg = ""

if tool == "Agent":
    prompt = ti.get("prompt", "")
    if re.search(r"anali[sz][ae].*(projeto|tudo|inteiro|todo)|ler tudo|explorar tudo|read all|explore all|analyz.*(entire|whole|project|all)|all files", prompt, re.IGNORECASE):
        broad = True
        msg = "Escopo amplo detectado. Restrinja o escopo para economizar tokens."

elif tool == "Glob":
    pattern = ti.get("pattern", "")
    if re.fullmatch(r"\*\*|\*\*/\*|\*", pattern):
        broad = True
        msg = "Glob muito amplo (%r). Considere filtrar por extensão." % pattern

elif tool == "Grep":
    path = ti.get("path", "")
    glob = ti.get("glob", "")
    if (not path or path == ".") and not glob:
        broad = True
        msg = "Grep sem caminho/filtro específico. Considere restringir."

if broad:
    print(json.dumps({"systemMessage": "[scope-warn] " + msg}))
'
