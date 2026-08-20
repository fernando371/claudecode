# 02 — Arquitetura em linguagem simples

## A ideia central

Imagine o sistema como uma **loja com três ambientes**:

1. **A recepção (API)** — recebe as mensagens e devolve as respostas.
2. **O escritório de regras (núcleo)** — decide o que pode e o que não pode ser dito.
3. **Os balcões dos fornecedores (adaptadores)** — falam com Shopify, SAP,
   transportadoras, Meta e IA.

A IA **nunca** vai direto ao balcão do fornecedor. Ela sempre pede ao escritório de
regras, que confere a permissão antes de qualquer coisa.

## Por que "adaptadores"?

Cada fornecedor externo tem um adaptador próprio. Trocar de fornecedor significa
trocar **uma peça**, não reconstruir o sistema.

| Assunto     | Versão simulada (usada hoje) | Versão real (preparada)                     |
| ----------- | ---------------------------- | ------------------------------------------- |
| WhatsApp    | `MockWhatsAppProvider`       | `MetaWhatsAppCloudProvider`                 |
| Catálogo    | `MockCatalogProvider`        | `ShopifyCatalogProvider`                    |
| Pedidos     | `MockOrderProvider`          | `ShopifyOrderProvider`                      |
| Nota Fiscal | `MockInvoiceProvider`        | `SapInvoiceProvider` (contrato)             |
| Rastreio    | `MockTrackingProvider`       | Mandaê, Correios, Fonteslog, TM (contratos) |
| IA          | `MockLLMProvider`            | `AnthropicLLMProvider`                      |

A troca é feita **só mudando o arquivo `.env`** — nenhuma linha de código muda.

## As pastas do projeto

```
apps/api        → a recepção: webhooks e endereços da API
apps/admin      → o painel e o simulador (o que você vê no navegador)
packages/core   → o escritório de regras: segurança, privacidade, orquestração
packages/shared → tipos e utilidades usados por todos
data/knowledge  → os textos oficiais que o agente pode usar
data/fixtures   → os dados fictícios de demonstração
docs            → esta documentação
```

## O que acontece quando chega uma mensagem

1. A mensagem é **limpa** (removemos truques usados para enganar a IA).
2. Verificamos se a mensagem **já foi processada antes** (evita resposta duplicada).
3. Identificamos o cliente e a conversa.
4. Se a conversa **já está com um atendente humano**, a IA não responde.
5. Se o **modo de emergência** está ligado, tudo vai para humano.
6. Procuramos tentativas de burlar o agente.
7. Verificamos se o cliente pediu para **parar as mensagens**.
8. Aplicamos as **regras de segurança de saúde**.
9. Classificamos a intenção.
10. Consultamos **só** as fontes necessárias, através das ferramentas permitidas.
11. Montamos a resposta com base em fonte oficial.
12. Conferimos a resposta antes de sair (rede de proteção final).
13. Registramos métricas e auditoria.

## Sobre o banco de dados

O protótipo usa **SQLite**, um banco que fica em um arquivo único dentro do projeto.
Não precisa instalar nada. Para produção, o plano é migrar para PostgreSQL
(explicado em `docs/adr/0002-banco-sqlite-sem-prisma.md`).

## Sobre a IA

Hoje o sistema usa um "gerador determinístico": ele monta as respostas a partir das
fontes oficiais, sempre do mesmo jeito. **Não usa IA generativa e não custa nada.**
Isso deixa o comportamento previsível e os testes confiáveis.

Se, no futuro, quisermos respostas mais naturais, basta ligar o adaptador da
Anthropic — que tem **cobrança separada** da assinatura do Claude Code.
