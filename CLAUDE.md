# Regras de sessão

- Respostas curtas e diretas
- Sem repetição de contexto anterior
- 1 pergunta por vez se faltar informação
- Opção mais simples primeiro
- Referenciar arquivos específicos nos prompts
- Use /compact em sessões longas, /clear ao mudar de assunto
- Monitore consumo com /stats ou /cost

# Controle de custo

- Rode `/cost` antes e depois de tarefas longas.
- Use `/compact` quando contexto > 50% ou antes de mudar de subtarefa.
- Nunca use `--resume` se a sessão anterior era sobre assunto diferente — inicie nova sessão.
- Se contexto > 70%, pare e compacte antes de continuar.
- Prefira Bash e MCP a computer-use (computer-use custa mais e é mais lento).
- Sugira `/compact` ao usuário após 20 trocas ou se o custo acumulado parecer alto.
