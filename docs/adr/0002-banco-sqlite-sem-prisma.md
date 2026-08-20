# ADR 0002 — Banco SQLite nativo do Node, sem Prisma nesta fase

**Data:** 2026-08-20 · **Situação:** aceito

## Em uma frase

Usamos o banco de dados que já vem dentro do Node.js, para o protótipo rodar
com um comando só, sem instalar nada extra.

## Contexto

O briefing sugeriu "Prisma ou camada equivalente de acesso ao banco".

## Decisão

Usar o módulo `node:sqlite`, que já vem no Node 22, com uma camada própria de
acesso a dados em `packages/core/src/db/repositorios.ts`.

## Por quê

- **Zero instalação extra.** O Prisma baixa binários próprios em cada máquina e
  em cada servidor. Isso costuma dar problema em Windows e em ambientes fechados.
- **Protótipo precisa ser simples.** O objetivo desta fase é testar as regras de
  negócio, não montar uma infraestrutura de banco.
- **Troca é fácil.** Todo o acesso ao banco está isolado em um arquivo só. Migrar
  para PostgreSQL com Prisma quando for para produção significa reescrever esse
  arquivo, não o sistema inteiro.

## Consequência

- SQLite não é adequado para produção com vários servidores. A migração para
  PostgreSQL está prevista em `docs/10-plano-de-implantacao.md`.
- `node:sqlite` ainda é marcado como experimental pelo Node. Para o protótipo é
  seguro; para produção, a migração já resolve isso.
