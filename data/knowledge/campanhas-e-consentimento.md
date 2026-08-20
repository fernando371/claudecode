---
titulo: 'Campanhas e consentimento (exemplo)'
fonte: 'Arquivo de exemplo do protótipo'
atualizado_em: '2026-08-20'
aprovado_por: 'Regra interna do projeto (revisão jurídica recomendada antes de ligar campanhas)'
status: 'aprovado'
canais: ['whatsapp', 'simulador']
proxima_revisao: '2026-11-20'
---

# Campanhas e consentimento

> **NESTA FASE TODO ENVIO ATIVO ESTÁ DESLIGADO.** A estrutura existe, mas
> `OUTBOUND_CAMPAIGNS_ENABLED=false` impede qualquer disparo.

## Três tipos de mensagem

| Tipo      | Exemplo                                   | Precisa de consentimento de marketing? |
| --------- | ----------------------------------------- | -------------------------------------- |
| Serviço   | Resposta a uma pergunta do cliente        | Não                                    |
| Utilidade | Aviso de que o pedido foi faturado        | Sim (utilidade)                        |
| Marketing | Recuperação de carrinho, recompra, oferta | Sim (marketing)                        |

## O que registramos para cada consentimento

Data, origem (onde a pessoa aceitou), finalidade e prova (texto do aceite).

## Cancelamento

Palavras como "parar", "sair", "cancelar", "não quero" revogam na hora os
consentimentos de marketing e utilidade e registram um pedido de interrupção.

## Limite de frequência

Padrão: no máximo 1 mensagem de campanha por cliente por semana (`CAMPAIGN_MAX_PER_CUSTOMER_PER_WEEK`).

## Regras da Meta

Envio fora da janela de 24 horas exige modelo (template) aprovado pela Meta e
respeita a categoria correta. Isso precisa ser conferido antes de ligar qualquer campanha.
