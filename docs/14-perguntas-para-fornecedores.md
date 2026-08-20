# 14 — Perguntas para fornecedores

Copie e cole cada bloco no e-mail ou na conversa com o fornecedor.
**Nunca peça que enviem token ou senha por chat, e-mail ou WhatsApp** — peça que
cadastrem no cofre de segredos ou entreguem por um canal seguro combinado.

---

## Para o responsável pelo SAP (ou pela integradora)

> Estamos avaliando um atendimento automatizado no WhatsApp que precisa **apenas
> consultar** (nunca alterar) informações de faturamento e Nota Fiscal.
>
> 1. Como o SAP disponibiliza esses dados hoje? É API REST, OData, SOAP, arquivo ou
>    uma integradora no meio?
> 2. Podem nos enviar a documentação técnica dessa interface?
> 3. Podem nos enviar um exemplo de resposta (pode ser com dados fictícios)?
> 4. Quais campos ficam disponíveis? Precisamos de: número da nota, série, chave de
>    acesso, data de emissão e, se existir, o link do DANFE.
> 5. Como o pedido do e-commerce (Shopify) se liga ao documento no SAP? É pelo número
>    do pedido, por um código interno ou por uma tabela de/para?
> 6. Qual é o método de autenticação?
> 7. Existe ambiente de homologação separado da produção? Como obtemos acesso?
> 8. Qual é o limite de consultas por minuto?
> 9. Existem janelas de indisponibilidade programada?
> 10. Há restrição por IP de origem?

---

## Para cada transportadora (Mandaê, Correios, Fonteslog, TM Logística)

> Precisamos consultar o rastreio dos nossos envios para informar o cliente.
>
> 1. Vocês oferecem API de rastreio? Qual o endereço e a documentação?
> 2. Como funciona a autenticação?
> 3. Existe ambiente de testes?
> 4. Qual é a lista completa de códigos de status e o significado de cada um?
> 5. A consulta é feita pelo código do objeto, pela nota fiscal ou pelo pedido?
> 6. Existe webhook de atualização, ou precisamos consultar de tempos em tempos?
> 7. Qual é o limite de consultas?
> 8. Qual é o prazo contratado (SLA) por região?
> 9. Como vocês informam extravio e devolução?
> 10. Existe custo para usar a API?

---

## Para um parceiro/BSP de WhatsApp (caso avaliem essa opção)

> 1. Vocês são parceiro oficial da Meta? Qual o número/registro?
> 2. Como é a cobrança: por conversa, por número, mensalidade fixa? Há mínimo mensal?
> 3. O custo das conversas da Meta é repassado com margem?
> 4. Conseguimos manter nosso próprio sistema e usar vocês só como canal?
> 5. Vocês dão acesso direto à Cloud API ou só à plataforma de vocês?
> 6. Como funciona a aprovação de modelos de mensagem?
> 7. Se sairmos, o número continua conosco? Qual o prazo de portabilidade?
> 8. Onde ficam armazenadas as conversas? Em qual país?
> 9. Vocês assinam contrato de tratamento de dados compatível com a LGPD?
> 10. Qual é o SLA de suporte?

---

## Para o time interno da FDC (conteúdo)

> 1. Quem é o responsável técnico que **aprova** informação sobre produto e uso?
> 2. Onde está o texto oficial do rótulo de cada SKU (composição, modo de uso,
>    advertências, porções)?
> 3. Qual é a política oficial de frete e prazo por região?
> 4. Qual é a política oficial de troca e devolução?
> 5. Qual é o horário de corte da expedição?
> 6. Qual é o posicionamento e o tom de voz de cada marca (Vitaminas e Nutrition)?
> 7. Com que frequência esses textos devem ser revisados?
> 8. Quem assume a fila de atendimento humano e em qual horário?

---

## Para a hospedagem (quando chegar a hora)

> 1. Oferecem PostgreSQL gerenciado com backup automático?
> 2. Qual é a retenção dos backups e como é feita a restauração?
> 3. Oferecem cofre de segredos (secrets manager)?
> 4. Os dados ficam em datacenter no Brasil?
> 5. Assinam contrato de tratamento de dados compatível com a LGPD?
> 6. Qual é o custo mensal estimado para uma aplicação pequena com banco?
