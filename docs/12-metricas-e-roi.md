# 12 — Métricas e ROI

## Onde ver

Painel → **Indicadores**. Nesta fase, todos os números vêm de **conversas simuladas**.
Eles provam que a medição funciona; **não** projetam resultado de negócio.

## Indicadores já medidos

### Atendimento

- Total de conversas e de mensagens
- Tempo de primeira resposta (mediana)
- Percentual resolvido automaticamente
- Percentual transferido para humano
- Motivos de contato (por intenção)

### Comercial

- Produtos mais consultados
- Links de produto e carrinho gerados
- Conversões assistidas (simuladas)
- Carrinhos recuperados (simulados)
- Receita assistida (simulada)

### Operação

- Consultas sobre atraso
- Erros de integração
- Respostas bloqueadas por segurança
- Fila de atendimento humano aberta

---

## Análise financeira

O modelo está em **`data/financeiro/modelo-roi.csv`**. Ele vem **sem nenhum valor
inventado** — cada linha diz onde buscar o número real.

### Ganhos a medir

| Item                            | Onde buscar                                                   |
| ------------------------------- | ------------------------------------------------------------- |
| Receita originada pelo WhatsApp | Pedidos cujo primeiro contato foi o WhatsApp                  |
| Receita assistida               | Pedidos com contato antes da compra (janela sugerida: 7 dias) |
| Margem de contribuição          | Receita assistida × margem média da FDC                       |
| Receita recuperada de carrinho  | Pedidos fechados após mensagem de carrinho                    |
| Receita de recompra             | Pedidos fechados após mensagem de reposição                   |
| Redução de horas de atendimento | Horas economizadas × custo/hora do atendente                  |

### Custos a medir

| Item                              | Onde buscar                                  |
| --------------------------------- | -------------------------------------------- |
| Meta (WhatsApp Business Platform) | Painel de faturamento da Meta                |
| Provedor de IA (API Anthropic)    | Console da Anthropic — **cobrança separada** |
| Fornecedor ou BSP                 | Contrato do parceiro, se houver              |
| Hospedagem                        | Fatura do provedor de nuvem                  |
| Implantação                       | Horas de desenvolvimento (custo único)       |
| Manutenção mensal                 | Horas de suporte e evolução                  |

### Contas

```
Ganho incremental       = soma dos ganhos
Custo mensal total      = soma dos custos recorrentes
Resultado mensal        = ganho incremental − custo mensal
Prazo de retorno (meses)= custo de implantação ÷ resultado mensal
```

---

## Aviso importante sobre custo de IA

A **assinatura do Claude Code não é crédito de API**. Se um dia ligarmos a IA
generativa, isso é uma contratação separada, com cobrança por uso, na Anthropic.
Hoje o sistema usa um gerador determinístico e **não gera custo nenhum**.

---

## Critério sugerido de continuidade

> O projeto só deve avançar para operação completa se os ganhos incrementais e as
> economias justificarem o custo recorrente, com expectativa realista de retorno da
> implantação em **até seis meses**.

## Como medir de forma honesta

1. Registre a linha de base **antes** de ligar qualquer coisa: volume de atendimento,
   horas gastas, taxa de conversão atual.
2. Use um período comparável (mesmos dias da semana, sem promoção atípica).
3. Prefira comparar com um **grupo de controle** (parte dos clientes sem o agente).
4. Desconte o que teria acontecido de qualquer jeito — nem toda venda assistida é
   venda incremental.
