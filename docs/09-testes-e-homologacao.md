# 09 — Testes e homologação

## Como rodar

```bash
npm test            # 122 testes de dentro do sistema (~2 segundos)
npm run test:e2e    # 10 testes de navegador, abrindo o painel de verdade (~20 segundos)
npm run check:all   # formatação + lint + tipos + testes + segredos
```

Quem mexer no painel deve rodar também o `npm run test:e2e`.

Nenhum teste depende de credencial, internet ou serviço pago.

## Os 25 cenários obrigatórios

Todos implementados em `tests/cenarios.test.ts` e **passando**:

| #   | Cenário                                 | Resultado esperado                      |
| --- | --------------------------------------- | --------------------------------------- |
| 1   | Cliente pergunta preço                  | Responde com preço do catálogo          |
| 2   | Cliente pergunta estoque                | Informa disponibilidade real            |
| 3   | Recomendação geral                      | Responde com aviso de não prescrição    |
| 4   | Cliente informa gravidez                | Transfere; não menciona produto         |
| 5   | Cliente informa medicamento             | Transfere                               |
| 6   | Reação adversa                          | Transfere com prioridade alta           |
| 7   | Status com dados corretos               | Mostra o pedido                         |
| 8   | Tenta acessar pedido de outro           | Recusa; não vaza nada                   |
| 9   | Pedido atrasado                         | Detecta e transfere                     |
| 10  | Pedido extraviado                       | Detecta e transfere com prioridade alta |
| 11  | Shopify indisponível                    | Avisa e transfere; não inventa          |
| 12  | SAP indisponível                        | Avisa e transfere                       |
| 13  | Transportadora com status desconhecido  | Não arrisca; transfere                  |
| 14  | Cliente pede para parar                 | Revoga consentimento                    |
| 15  | Prompt injection                        | Bloqueia                                |
| 16  | Pede segredo/token                      | Bloqueia                                |
| 17  | Pede dados de outro cliente             | Bloqueia                                |
| 18  | Webhook enviado duas vezes              | Ignora a segunda                        |
| 19  | Produto não existe                      | Admite que não encontrou                |
| 20  | Base de conhecimento vencida            | Não usa o documento                     |
| 21  | Informação não aprovada                 | Não usa em produção                     |
| 22  | Atendente assume a conversa             | IA para de responder                    |
| 23  | IA desativada por emergência            | Tudo vai para humano                    |
| 24  | Envio real bloqueado                    | Confirmado por teste                    |
| 25  | Vitaminas + Nutrition no mesmo carrinho | Funciona                                |

## Outros testes

- **Unitários (49):** mascaramento, assinatura do webhook, normalização de mensagens
  da Meta, regras de saúde, prompt injection, identificação de pedido, regra de
  atraso, lista fechada de ferramentas, campanhas e consentimento, base de
  conhecimento, classificação de intenção.
- **Atendimento humano (12):** leitura do histórico com mascaramento, resposta do
  atendente, silêncio da IA durante o atendimento, anotações internas, encerramento
  e devolução ao agente, e a garantia de que a resposta humana também não escapa da
  trava de envio real.
- **LGPD (16):** expurgo pela política de retenção (respeita os prazos, apaga o
  relato de saúde antes do resto, mantém o registro do próprio expurgo, pode rodar
  duas vezes seguidas), exclusão dos dados de um cliente e interrupção de comunicações.
- **Integração da API (20):** verificação e assinatura do webhook, simulador,
  ausência de segredos nas respostas, mascaramento dos pedidos e controle de acesso
  do painel (incluindo o bloqueio em produção sem senha).

## Testes de navegador (10)

Sobem o sistema inteiro e repetem o caminho de uma pessoa de verdade:

| Teste                          | O que garante                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Visão geral abre com as travas | O painel sobe e mostra o estado das travas                                                                           |
| Integrações                    | Nenhuma integração real está ligada                                                                                  |
| Base de conhecimento           | Os documentos aparecem com o status certo                                                                            |
| Preço no simulador             | O agente responde com dado do catálogo                                                                               |
| Prompt injection               | O agente recusa e marca como bloqueado                                                                               |
| Gravidez                       | O agente transfere em vez de indicar produto                                                                         |
| Shopify fora do ar             | O agente avisa e não inventa preço                                                                                   |
| **Atendimento ponta a ponta**  | Cliente escreve → fila recebe → atendente lê o histórico mascarado, responde → cliente recebe → encerrou, a IA volta |
| Expurgo pelo painel            | A política de retenção roda pelo botão                                                                               |
| Exclusão                       | Pede confirmação em duas etapas antes de apagar                                                                      |

## Homologação manual sugerida

Antes de qualquer piloto real, percorra no **Simulador de Conversas**:

- [ ] Uma conversa comercial completa (produto → preço → carrinho).
- [ ] Uma consulta de pedido com dados certos e outra com dados errados.
- [ ] Um pedido atrasado e um extraviado.
- [ ] Uma menção a gravidez, uma a medicamento e uma a reação adversa.
- [ ] Shopify fora do ar, SAP fora do ar e transportadora sem status.
- [ ] Uma tentativa de burlar o agente.
- [ ] Abrir uma conversa pela fila, **responder como atendente** e conferir que a
      resposta aparece no simulador (botão **Atualizar**).
- [ ] Deixar uma anotação interna e confirmar que ela **não** aparece para o cliente.
- [ ] Encerrar o atendimento e confirmar que a IA volta a responder.
- [ ] Ligar e desligar o modo de emergência.

Ao final, confira a aba **Eventos de auditoria** e verifique que nenhum dado
pessoal aparece por inteiro.
