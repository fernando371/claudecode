# claudecode

Repositório de configuração do Claude Code.

## Arquivos

| Arquivo | Evento | Função |
|---------|--------|--------|
| `CLAUDE.md` | — | Regras de sessão, custo, referência ao contexto persistente |
| `.claude/project-context.md` | — | Memória persistente: decisões, convenções, histórico |
| `.claude/session-log.md` | Stop | Log de custo/tokens por sessão (gitignored) |
| `.claude/session-log-archive.md` | Stop | Entradas > 30 dias rotacionadas do session-log (gitignored) |
| `.claude/bash-log.md` | PostToolUse/Bash | Log de comandos Bash com timestamp e status (gitignored) |
| `.claude/settings.json` | — | Configuração de hooks por evento/ferramenta |
| `.claude/hooks/pre-tool-scope-warn.sh` | PreToolUse | Alerta: escopo amplo (Agent/Glob/Grep) |
| `.claude/hooks/pre-tool-cost-warn.sh` | PreToolUse | Alerta: operações de alto custo (Agent/Bash/Glob) |
| `.claude/hooks/pre-tool-workspace-guard.sh` | PreToolUse | Bloqueia Edit/Write fora do workspace |
| `.claude/hooks/pre-tool-github-guard.sh` | PreToolUse | Guard em push/delete/merge via MCP GitHub |
| `.claude/hooks/post-edit.sh` | PostToolUse | Verifica sintaxe após edição (py/js/ts/sh) |
| `.claude/hooks/post-bash-log.sh` | PostToolUse | Loga comandos Bash em bash-log.md |
| `.claude/hooks/stop-session-log.sh` | Stop | Registra custo, tokens, alerta de contexto cheio, rotação do log |
| `.claude/skills/systematic-debugging.md` | — | Skill: root cause antes de qualquer fix |
| `.claude/skills/verification-before-completion.md` | — | Skill: evidência antes de qualquer claim de sucesso |
| `.claude/skills/update-context.md` | — | Skill: quando e como atualizar project-context.md |

## Melhorias implementadas

| # | Melhoria |
|---|----------|
| 1 | Log automático de custo/tokens por sessão (Stop hook) |
| 2 | Memória persistente entre sessões (project-context.md) |
| 3 | TypeScript type-check no post-edit (tsc --noEmit) |
| 4 | Guard: Edit/Write fora do workspace |
| 5 | Log de comandos Bash com timestamp e status |
| 6 | Skill update-context com regras de quando/como atualizar |
| 7 | Rotação do session-log.md após 30 dias |
| 8 | Alerta de contexto cheio (> 80k tokens) no Stop hook |
| 9 | ~~MCP local para project-context.md~~ — descartado: overhead sem ganho para arquivo de 50 linhas |
| 10 | Guard: push/delete/merge via MCP GitHub |
| — | Skills cherry-picked: systematic-debugging, verification-before-completion |