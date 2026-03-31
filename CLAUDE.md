# Contexto persistente

Leia `.claude/project-context.md` no início de cada sessão para recuperar decisões e convenções acumuladas.

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

# Skills — quando aplicar

Ao encontrar qualquer bug, falha de teste ou comportamento inesperado:
→ aplique `.claude/skills/systematic-debugging.md` antes de propor qualquer fix.

Antes de qualquer commit, push, afirmação de "pronto", "feito" ou "funcionando":
→ aplique `.claude/skills/verification-before-completion.md` e execute o comando de verificação.

# Encerramento de sessão

Ao fim de qualquer sessão que produziu decisão arquitetural, nova convenção ou regra relevante:
→ aplique `.claude/skills/update-context.md` e atualize `.claude/project-context.md` antes de parar.
