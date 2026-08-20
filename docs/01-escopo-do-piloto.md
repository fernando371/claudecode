# 01 — Escopo do piloto

## Objetivo em uma frase

Provar que um agente de WhatsApp consegue atender, vender e resolver pós-venda da
FDC com segurança, antes de gastar dinheiro com integrações e mensagens reais.

## O que ENTRA nesta fase

- Agente que responde sobre produtos, preço, disponibilidade, composição e modo de uso
  (sempre com base em fonte oficial aprovada).
- Consulta de pedido, Nota Fiscal, rastreio e prazo, com confirmação de identidade.
- Detecção de possível atraso e de extravio.
- Transferência para atendente humano.
- Registro de motivos de contato e indicadores.
- Simulador completo, sem internet e sem custo.
- Estrutura (desligada) para carrinho abandonado, recompra e campanhas.

## O que NÃO entra nesta fase

- Envio real de mensagem pelo WhatsApp.
- Qualquer alteração em Shopify, SAP, Meta ou sistemas logísticos.
- Campanhas e disparos ativos.
- Fluxos voltados a compradores de marketplace (Mercado Livre e outros).
- Projeto da Villa Jacumã.
- Instagram e outros canais (a arquitetura já prevê, mas não implementamos).

## Público do piloto

Clientes do **site oficial** e pessoas que procuram diretamente o **WhatsApp oficial
da FDC**.

## Sobre marketplaces

Não criamos nenhum fluxo que leve o comprador do Mercado Livre para fora da
plataforma. Qualquer uso relacionado a marketplace fica **desabilitado** até as
regras do canal serem formalmente verificadas.

## Duas marcas, uma loja

FDC Vitaminas e FDC Nutrition têm comunicação diferente, mas convivem no mesmo
e-commerce e podem estar no **mesmo carrinho**. O agente trata isso como normal.

## Critério para esta fase ser considerada concluída

- [x] O projeto roda no computador com um comando.
- [x] O simulador está acessível.
- [x] Os principais fluxos podem ser testados.
- [x] Nenhuma credencial real é necessária.
- [x] Nenhuma mensagem real pode ser enviada.
- [x] Os testes passam.
- [x] A verificação do projeto passa.
- [x] As regras de segurança estão implementadas.
- [x] A documentação para leigos está pronta.
- [x] As pendências externas estão listadas.
