# 09 — Testes e homologação

## Como rodar

```bash
npm test            # roda os 89 testes
npm run check:all   # formatação + lint + tipos + testes + segredos
```

São **105 testes**. Nenhum depende de credencial, internet ou serviço pago.

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
- **Integração da API (19):** verificação e assinatura do webhook, simulador,
  ausência de segredos nas respostas, mascaramento dos pedidos e controle de acesso
  do painel (incluindo o bloqueio em produção sem senha).

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
