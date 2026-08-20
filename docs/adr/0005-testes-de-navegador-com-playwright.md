# ADR 0005 — Testes de navegador com Playwright

**Data:** 2026-08-20 · **Situação:** aceito · **Substitui:** [ADR 0004](0004-testes-sem-playwright-nesta-fase.md)

## Em uma frase

Agora um robô abre o painel no navegador e repete o caminho que uma pessoa faz,
para garantir que o atendimento humano continue funcionando de verdade.

## Contexto

O ADR 0004 dispensou o Playwright enquanto o painel fosse só uma camada de
exibição, e registrou a condição para voltar atrás: telas de operação crítica.

Essa condição foi atendida. Com a tela de atendimento humano, uma pessoa escreve
uma mensagem no painel e ela **vai para o cliente**. Se essa tela quebrar, o time
de atendimento fica sem saber — os testes de dentro do sistema não pegariam isso.

## Decisão

Incluir Playwright em uma trilha **separada** dos testes rápidos:

- `npm test` — 122 testes de dentro do sistema, rodam em ~2 segundos.
- `npm run test:e2e` — 10 testes de navegador, sobem o sistema inteiro e rodam
  em ~20 segundos.

O navegador usado é o Chromium que já estiver instalado na máquina
(`CHROMIUM_EXECUTABLE_PATH` ou caminhos conhecidos). Nada é baixado.

## O que os testes de navegador cobrem

O caminho crítico completo: o cliente escreve no simulador, a conversa é
transferida, o caso aparece na fila, o atendente abre a conversa, lê o histórico
mascarado, responde, o cliente recebe a resposta e, ao encerrar, a IA volta a
responder. Mais as travas visíveis (nada real conectado) e as ações de LGPD.

## Por que em trilha separada

Os testes de navegador são mais lentos e sobem dois servidores. Mantê-los fora do
`npm test` preserva a regra de que a verificação do dia a dia é rápida e não
depende de nada externo.

## Consequência

Quem alterar o painel deve rodar `npm run test:e2e` antes de entregar.
Está registrado em `docs/09-testes-e-homologacao.md`.
