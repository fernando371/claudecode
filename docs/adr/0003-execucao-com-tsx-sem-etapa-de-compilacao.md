# ADR 0003 — Executar o backend direto do TypeScript (tsx)

**Data:** 2026-08-20 · **Situação:** aceito

## Em uma frase

O backend roda direto do código-fonte, sem uma etapa separada de "compilar".

## Decisão

- `npm run dev` e `npm start` executam o backend com **tsx**.
- `npm run build` faz a **verificação completa de tipos** de todo o projeto e
  compila o painel (Next.js).

## Por quê

Em um monorepositório, obrigar cada pacote a gerar arquivos compilados cria uma
etapa a mais que quebra com frequência e não traz benefício nesta fase. A
verificação de erros continua acontecendo — só não gera arquivos intermediários.

## Consequência

Para produção, recomenda-se gerar um pacote compilado ou uma imagem Docker.
Está previsto em `docs/10-plano-de-implantacao.md`.
