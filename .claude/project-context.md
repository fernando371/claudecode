# Contexto do Projeto

> Arquivo de memória persistente. Atualize ao fim de cada sessão com decisões tomadas.
> Lido automaticamente no início de cada sessão via CLAUDE.md.

## Propósito do repositório

Repositório de configuração do Claude Code: hooks, regras de sessão, agents, skills e contexto acumulado.

## Estrutura atual

```
.claude/
  agents/          # Subagentes especializados (5 ativos)
  hooks/           # Scripts de hook por evento
  skills/          # Skills de workflow (3 ativos)
  project-context.md
  settings.json
CLAUDE.md
```

## Decisões arquiteturais

- Hooks organizados em `.claude/hooks/`, um arquivo por responsabilidade
- `settings.json` usa matchers explícitos por classe de ferramenta
- Regras de sessão ficam em `CLAUDE.md`; conhecimento acumulado aqui
- Agents ficam em `.claude/agents/` com frontmatter name/description/tools/model
- Skills ficam em `.claude/skills/` com frontmatter name/description
- Logs gerados por hooks (session-log, bash-log) são gitignored
- `session-log-archive.md` recebe entradas > 30 dias via rotação automática no Stop hook

## Convenções

- Scripts de hook: bash + python3 inline para parsing JSON
- Saída de hook via `systemMessage` em JSON para PreToolUse (warning, não bloqueio)
- Saída de texto livre para PostToolUse/Stop (vai para o log ou stdout)
- Agentes usam `model: opus` para planejamento/arquitetura, `sonnet` para execução, `inherit` para review
- Cherry-pick de conteúdo externo: incluir atribuição na última linha do arquivo

## O que não fazer

- Não usar `--no-verify` em commits
- Não criar arquivos de documentação sem solicitação explícita
- Não instalar dependências sem confirmar com o usuário
- Não criar MCP server para `project-context.md` — overhead desnecessário para arquivo pequeno
- Não adotar `chief-of-staff`, `performance-optimizer`, `refactor-cleaner` — irrelevantes ou sem conteúdo verificado
- Não adicionar mais hooks de PreToolUse sem necessidade clara — casos relevantes já cobertos

## Hooks ativos

| Hook | Evento | Matcher |
|------|--------|---------|
| `pre-tool-scope-warn.sh` | PreToolUse | Agent\|Glob\|Grep |
| `pre-tool-cost-warn.sh` | PreToolUse | Agent\|Bash\|Glob |
| `pre-tool-workspace-guard.sh` | PreToolUse | Edit\|Write\|NotebookEdit |
| `pre-tool-github-guard.sh` | PreToolUse | mcp__github__push_files\|create_or_update_file\|delete_file\|merge_pull_request |
| `post-edit.sh` | PostToolUse | Edit\|Write\|NotebookEdit |
| `post-bash-log.sh` | PostToolUse | Bash |
| `stop-session-log.sh` | Stop | — |

## Agents ativos

| Agent | Modelo | Trigger |
|-------|--------|---------|
| `code-reviewer` | inherit | Após step/feature significativa |
| `security-reviewer` | sonnet | Após código com input/auth/API/dados sensíveis |
| `planner` | opus | Features complexas ou refatorações |
| `architect` | opus | Decisões de design, trade-offs, ADRs |
| `tdd-guide` | sonnet | Features novas, bug fixes, refatorações |

## Skills ativos

| Skill | Trigger (via CLAUDE.md) |
|-------|------------------------|
| `systematic-debugging` | Qualquer bug, falha de teste, comportamento inesperado |
| `verification-before-completion` | Antes de qualquer commit, push ou claim de sucesso |
| `update-context` | Fim de sessão com decisões relevantes |

## Histórico de decisões relevantes

2026-03-31: Adicionado hook Stop para log automático de custo/tokens por sessão
2026-03-31: Criado project-context.md como memória persistente do projeto
2026-03-31: Cherry-pick de systematic-debugging e verification-before-completion de obra/superpowers
2026-03-31: Implementados hooks #3 (tsc --noEmit), #4 (workspace guard), #5 (bash log), #7 (rotação), #8 (alerta contexto), #10 (github guard)
2026-03-31: CLAUDE.md atualizado com gatilhos automáticos de skills e instrução de encerramento de sessão
2026-03-31: 5 agents criados: code-reviewer (superpowers), security-reviewer, planner, architect, tdd-guide (everything-claude-code)
2026-03-31: MCP local para project-context.md descartado — overhead sem ganho para arquivo pequeno
