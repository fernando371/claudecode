# ADR 0001 — Node.js, TypeScript, Fastify e Next.js

**Data:** 2026-08-20 · **Situação:** aceito

## Em uma frase

Escolhemos ferramentas modernas, gratuitas e muito comuns no mercado, para que
qualquer equipe de desenvolvimento consiga assumir o projeto depois.

## Decisão

- **Node.js 22 (LTS)** com **npm** — funciona bem no Windows, sem configuração extra.
- **TypeScript em modo estrito** — o computador confere erros antes de o sistema rodar.
- **Fastify** no backend — rápido, com validação de entrada e documentação automática.
- **Next.js + React** no painel — padrão de mercado para telas administrativas.
- **Vitest** para os testes.

## Por quê

São as escolhas mais fáceis de contratar, manter e substituir. Nada aqui prende
o projeto a um fornecedor específico.

## Consequência

Quem assumir o projeto encontra estrutura conhecida. O custo de troca de equipe é baixo.
