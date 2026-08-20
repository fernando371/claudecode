# ADR 0004 — Sem Playwright nesta fase

**Data:** 2026-08-20 · **Situação:** aceito

## Em uma frase

Testamos as regras por dentro (89 testes automatizados) em vez de simular cliques
no navegador.

## Contexto

O briefing pedia Playwright "se for viável".

## Decisão

Não incluir Playwright agora.

## Por quê

- Toda a lógica que precisa de garantia (segurança de saúde, privacidade,
  autenticação de pedido, bloqueio de envio real) está no núcleo e já é testada.
- O painel é uma camada de exibição: um teste de navegador daria pouca proteção
  extra e adicionaria dependências pesadas ao projeto.

## Consequência

Quando o painel ganhar telas de operação crítica (por exemplo, disparo de
campanha real), o Playwright deve ser incluído. Está registrado em
`STATUS-DO-PROJETO.md` como pendência técnica.
