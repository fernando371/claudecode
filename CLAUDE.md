# Regras de sessão

- Respostas curtas e diretas
- Sem repetição de contexto anterior
- 1 pergunta por vez se faltar informação
- Opção mais simples primeiro
- Referenciar arquivos específicos nos prompts
- Use /compact em sessões longas, /clear ao mudar de assunto
- Monitore consumo com /stats ou /cost

# Sugestão automática de /compact

Se a sessão tiver mais de 20 trocas ou o contexto estiver acima de 50%, sugira ao usuário rodar /compact.

# Cost and context rules

- Prefer /compact over resuming large sessions.
- Avoid --resume for high-cost sessions unless necessary.
- Use /cost before and after long tasks.
- Suggest /compact when the session gets long.
- Use computer-use only for GUI-only workflows.
- Prefer Bash, MCP, or Chrome before computer-use.
