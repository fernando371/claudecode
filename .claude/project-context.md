# Contexto do Projeto

> Arquivo de memória persistente. Atualize ao fim de cada sessão com decisões tomadas.
> Lido automaticamente no início de cada sessão via CLAUDE.md.

## Propósito do repositório

Repositório de configuração do Claude Code: hooks, regras de sessão e contexto acumulado.

## Decisões arquiteturais

- Hooks organizados em `.claude/hooks/`, um arquivo por responsabilidade
- `settings.json` usa matchers explícitos por classe de ferramenta
- Regras de sessão ficam em `CLAUDE.md`; conhecimento acumulado aqui

## Convenções

- Scripts de hook: bash + python3 inline para parsing JSON
- Saída de hook via `systemMessage` em JSON para PreToolUse
- Saída de texto livre para PostToolUse/Stop (vai para o log)

## O que não fazer

- Não usar `--no-verify` em commits
- Não criar arquivos de documentação sem solicitação explícita
- Não instalar dependências sem confirmar com o usuário

## Histórico de decisões relevantes

<!-- Adicione entradas no formato: YYYY-MM-DD: decisão tomada -->
2026-03-31: Adicionado hook Stop para log automático de custo/tokens por sessão
2026-03-31: Criado project-context.md como memória persistente do projeto
