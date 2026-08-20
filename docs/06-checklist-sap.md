# 06 — Checklist SAP (Nota Fiscal)

> **Importante:** eu **não inventei** nenhum endereço, formato ou campo do SAP.
> O sistema tem apenas o **contrato** de integração pronto (`InvoiceProvider`).
> A implementação real está bloqueada até recebermos as informações abaixo.

## O que precisamos saber

### 1. Como a integração acontece hoje

- [ ] É API REST? OData? SOAP? Troca de arquivos? Middleware/integradora?
- [ ] Existe uma empresa intermediária cuidando disso? Qual?

### 2. Documentação

- [ ] Documentação técnica da interface usada para consultar faturamento.
- [ ] Exemplo real de resposta (pode vir com dados fictícios).

### 3. Campos disponíveis

Precisamos, no mínimo, de:

- [ ] Número da Nota Fiscal
- [ ] Série
- [ ] Chave de acesso (44 dígitos)
- [ ] Data e hora da emissão
- [ ] Link do DANFE (PDF), se existir
- [ ] Como o pedido do Shopify se relaciona com o documento no SAP
      (é o número do pedido? um código interno? uma tabela de/para?)

### 4. Autenticação

- [ ] Usuário e senha? Certificado? Token? OAuth?
- [ ] Há restrição por IP de origem?

### 5. Ambiente de homologação

- [ ] Existe ambiente de testes separado do de produção?
- [ ] Como conseguimos acesso a ele?

### 6. Limites

- [ ] Quantas consultas por minuto são permitidas?
- [ ] Há janela de indisponibilidade programada?

## Como o sistema se comporta enquanto isso não existe

- Em modo simulado, ele responde normalmente com Nota Fiscal fictícia.
- Se você trocar para `INVOICE_PROVIDER=sap`, o adaptador responde
  "integração ainda não definida" e a conversa vai para um atendente.
- **Em nenhum momento ele inventa número de nota ou chave de acesso.**

## Nunca envie pelo chat

Usuário, senha, certificado ou chave de acesso do SAP.
