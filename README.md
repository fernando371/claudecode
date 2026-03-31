# claudecode

Repositório de configuração do Claude Code.

## Arquivos

- `CLAUDE.md` — regras de sessão, custo e referência ao contexto persistente
- `.claude/project-context.md` — memória persistente: decisões, convenções, histórico
- `.claude/session-log.md` — log automático de custo/tokens por sessão (gerado pelo hook Stop)
- `.claude/settings.json` — configuração de hooks por evento/ferramenta
- `.claude/hooks/pre-tool-scope-warn.sh` — alerta PreToolUse: escopo amplo (Agent/Glob/Grep)
- `.claude/hooks/pre-tool-cost-warn.sh` — alerta PreToolUse: operações de alto custo (Agent/Bash/Glob)
- `.claude/hooks/post-edit.sh` — PostToolUse: verifica sintaxe após edição (py/js/sh)
- `.claude/hooks/stop-session-log.sh` — Stop: registra custo e tokens ao fim da sessão

## Mapa de melhorias

### Implementadas

| # | Melhoria | Arquivo | Evento |
|---|----------|---------|--------|
| 1 | Log automático de custo/tokens por sessão | `stop-session-log.sh` | `Stop` |
| 2 | Memória persistente entre sessões | `project-context.md` + `CLAUDE.md` | — |

### Backlog (priorizadas por impacto/esforço)

| # | Melhoria | Esforço | Impacto | Notas |
|---|----------|---------|---------|-------|
| 3 | **TypeScript no post-edit**: rodar `tsc --noEmit` se `tsconfig.json` existir | baixo | médio | `post-edit.sh` atual ignora `.ts` |
| 4 | **Hook `PreToolUse` para Write/Edit fora do workspace**: alertar se `file_path` estiver fora do diretório do projeto | baixo | alto | Evita edições acidentais em arquivos do sistema |
| 5 | **Hook `PostToolUse` para Bash**: logar comandos executados com timestamp em `.claude/bash-log.md` | baixo | médio | Rastreabilidade; complementa os alertas de PreToolUse |
| 6 | **Skill local `update-context`**: instrução reutilizável para atualizar `project-context.md` ao fim de sessão | médio | médio | Hoje depende de instrução manual no CLAUDE.md |
| 7 | **Rotação do session-log.md**: arquivar entradas com mais de 30 dias em `session-log-archive/` | baixo | baixo | Evita crescimento ilimitado do log |
| 8 | **Alerta de contexto cheio**: hook que lê `usage.input_tokens` no Stop e sugere `/compact` se > 80k | baixo | alto | Automatiza a regra manual "se contexto > 70%, compacte" |
| 9 | **MCP local para projeto**: servidor MCP mínimo expondo `project-context.md` como recurso consultável | alto | médio | Permite que o assistente busque contexto sob demanda sem ler arquivo manualmente |
| 10 | **`PreToolUse` para `mcp__github__push_files`**: confirmar branch antes de push | médio | alto | Segurança: evitar push acidental para branch errada |