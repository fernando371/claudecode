# 07 — Checklist Logística

> Nenhuma API de transportadora foi inventada. Existem os **contratos** e os
> adaptadores vazios para Mandaê, Correios, Fonteslog e TM Logística.

## Situações que o sistema já sabe representar

| Situação            | O que o agente faz                          |
| ------------------- | ------------------------------------------- |
| Aguardando coleta   | Informa e acompanha                         |
| Coletado            | Informa                                     |
| Em trânsito         | Informa                                     |
| Saiu para entrega   | Informa                                     |
| Entregue            | Informa e encerra                           |
| Atrasado            | Informa e **transfere para humano**         |
| Extraviado          | Informa e **transfere com prioridade alta** |
| Devolvido           | Informa e transfere                         |
| Erro / desconhecido | Não arrisca: transfere para humano          |

## Regra de possível atraso

O agente compara, sempre com datas reais:

1. Data do faturamento
2. Horário de corte da expedição (padrão configurado: 14h)
3. Data da coleta
4. Previsão de entrega
5. Última movimentação (suspeito a partir de 5 dias parado)
6. Prazo prometido ao cliente

Se faltar informação para concluir, ele marca como **indefinido** e transfere —
nunca chuta.

## O que precisamos de cada transportadora

Para **cada uma** (Mandaê, Correios, Fonteslog, TM Logística):

- [ ] Existe API de rastreio? Qual o endereço?
- [ ] Documentação técnica.
- [ ] Como é a autenticação (token, usuário/senha, certificado)?
- [ ] Existe ambiente de testes?
- [ ] Quais são os códigos de status e o que cada um significa?
- [ ] Qual é o limite de consultas?
- [ ] O rastreio é por código do objeto, por nota fiscal ou por pedido?
- [ ] Existe webhook de atualização, ou precisamos consultar de tempos em tempos?
- [ ] Qual é o prazo contratado (SLA) por região?

## Prioridade sugerida

Comece pela transportadora com **maior volume**. Uma integração real já resolve a
maior parte das dúvidas de rastreio.

- [ ] Me informar quais transportadoras são realmente usadas hoje e o volume de cada.

## Nunca envie pelo chat

Tokens e senhas de qualquer transportadora.
