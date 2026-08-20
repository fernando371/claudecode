---
titulo: 'Combinações aprovadas e prazos de recompra (exemplo)'
fonte: 'Arquivo de exemplo do protótipo — substituir por conteúdo oficial da FDC'
atualizado_em: '2026-08-20'
aprovado_por: 'PENDENTE - definir responsável'
status: 'rascunho'
canais: ['whatsapp', 'simulador']
proxima_revisao: '2026-11-20'
---

# Combinações e recompra

> **ATENÇÃO: CONTEÚDO DE EXEMPLO.** Nada aqui representa recomendação real da FDC.
> Este arquivo existe para o protótipo funcionar. Enquanto o status for `rascunho`,
> ele **não pode ser usado em produção** — o agente simplesmente não sugere combinação.

## Como este arquivo é usado

O agente **não inventa combinação**. Ele só sugere pares que estiverem na tabela
abaixo, e só quando nenhuma regra de segurança de saúde tiver sido acionada.

A sugestão é sempre **genérica**: nunca é personalizada por informação de saúde que
o cliente tenha mencionado. Se o cliente falar de doença, medicamento, gravidez,
alergia ou qualquer outro gatilho, a conversa vai para um atendente e nenhuma
combinação é oferecida.

## Combinações aprovadas

Formato: `SKU A | SKU B | Motivo (texto que o agente pode usar)`

| SKU A             | SKU B         | Motivo                                             |
| ----------------- | ------------- | -------------------------------------------------- |
| DEMO-WHEY-900-BAU | DEMO-CREA-300 | [EXEMPLO] Combinação comum na rotina de treino.    |
| DEMO-WHEY-900-CHO | DEMO-CREA-300 | [EXEMPLO] Combinação comum na rotina de treino.    |
| DEMO-VITC-60      | DEMO-VITD-60  | [EXEMPLO] Dupla frequente na linha do dia a dia.   |
| DEMO-VITD-60      | DEMO-MAG-120  | [EXEMPLO] Dupla frequente na linha do dia a dia.   |
| DEMO-WHEY-900-BAU | DEMO-VITD-60  | [EXEMPLO] Itens das duas linhas no mesmo carrinho. |
| DEMO-CREA-300     | DEMO-MAG-120  | [EXEMPLO] Itens das duas linhas no mesmo carrinho. |

## Duração estimada de cada embalagem

Serve para o agente saber quando o produto do cliente provavelmente está acabando.
É uma estimativa de **rótulo** (porções por embalagem), não uma recomendação de uso.

Formato: `SKU | Dias de duração estimada`

| SKU               | Dias |
| ----------------- | ---- |
| DEMO-VITC-60      | 60   |
| DEMO-VITC-120     | 120  |
| DEMO-VITD-60      | 60   |
| DEMO-MAG-120      | 60   |
| DEMO-WHEY-900-BAU | 30   |
| DEMO-WHEY-900-CHO | 30   |
| DEMO-CREA-300     | 100  |

## O que ainda falta

- Validação de cada combinação pelo responsável técnico.
- Confirmação dos dias de duração com base no rótulo oficial.
- Definição de quem aprova e com que frequência isso é revisado.
