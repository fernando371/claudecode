# claudecode

Repositório de configuração do Claude Code.

## Arquivos

- `CLAUDE.md` — regras de sessão, custo e contexto para o assistente.

---

# FDC Replenishment Worker

Worker de recompra automática para a loja Shopify da FDC Vitaminas.
Recebe webhooks de pedidos pagos, agenda lembretes por SKU com base nos metafields de reposição
configurados em cada produto, e envia e-mails na data certa.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Instalação local](#instalação-local)
- [Migrations de banco](#migrations-de-banco)
- [Rodando em desenvolvimento](#rodando-em-desenvolvimento)
- [Testes](#testes)
- [Deploy na Vercel](#deploy-na-vercel)
- [Configurar webhook na Shopify](#configurar-webhook-na-shopify)
- [Metafields dos produtos](#metafields-dos-produtos)
- [API Admin](#api-admin)
- [Template de e-mail](#template-de-e-mail)
- [Fluxo de processamento](#fluxo-de-processamento)

---

## Arquitetura

```
Shopify → POST /webhooks/orders/paid
              ↓
         HMAC validation
              ↓
         Idempotency check (processed_webhooks)
              ↓
         Busca metafields do produto (GraphQL)
              ↓
         Cria replenishment_schedules (trigger_date = paid_at + reminder_delay_days)
              ↓
         Cron (a cada hora) → GET /api/cron/process
              ↓
         Preflight: e-mail válido? aceita marketing? produto ativo? estoque? recomprou?
              ↓
         Envia e-mail → Resend
              ↓
         Atualiza status + replenishment_logs
```

---

## Pré-requisitos

- Node.js ≥ 20
- PostgreSQL ≥ 14 (ou Supabase)
- Conta Resend (ou SendGrid/Brevo — adapte `src/services/email.ts`)
- App Shopify com permissão `read_orders`, `read_products`, `read_customers`

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Descrição |
|---|---|
| `SHOPIFY_SHOP_DOMAIN` | Ex.: `fdc-vitaminas.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Token do app Shopify (prefixo `shpat_`) |
| `SHOPIFY_WEBHOOK_SECRET` | Secret gerado ao criar o webhook na Shopify |
| `DATABASE_URL` | Connection string PostgreSQL |
| `RESEND_API_KEY` | API key do Resend |
| `EMAIL_FROM` | Endereço remetente (ex.: `noreply@fdcvitaminas.com.br`) |
| `EMAIL_FROM_NAME` | Nome do remetente (ex.: `FDC Vitaminas`) |
| `APP_URL` | URL pública do deploy (ex.: `https://fdc-replenishment.vercel.app`) |
| `ADMIN_SECRET` | Bearer token para a API admin |
| `CRON_SECRET` | Bearer token que a Vercel envia no cron (gerado pela Vercel automaticamente) |
| `PORT` | Porta local (padrão: `3000`) |

---

## Instalação local

```bash
git clone <repo>
cd fdc-replenishment-worker
npm install
cp .env.example .env
# Edite .env com seus valores
```

---

## Migrations de banco

```bash
# Cria todas as tabelas
npm run migrate
```

O script executa `src/db/migrations/001_initial.sql` diretamente no banco.

---

## Rodando em desenvolvimento

```bash
npm run dev
# Servidor em http://localhost:3000

# Em outro terminal, rode o processador de agendamentos manualmente:
npm run cron
```

Para receber webhooks localmente, use o [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
ou o ngrok:

```bash
ngrok http 3000
# Configure o webhook na Shopify para: https://<ngrok-url>/webhooks/orders/paid
```

---

## Testes

```bash
npm test
```

Cobre:
- Cálculo da data de disparo (`calcTriggerDate`)
- Validação de HMAC
- Idempotência de webhook (webhook duplicado ignorado)
- Bloqueio por produto sem estoque
- Bloqueio por cliente sem consentimento de marketing
- Bloqueio por recompra após o pedido original

---

## Deploy na Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

Configure todas as variáveis de ambiente no painel da Vercel em
**Settings → Environment Variables**.

O cron está definido em `vercel.json` para rodar a cada hora:

```json
{
  "crons": [{ "path": "/api/cron/process", "schedule": "0 * * * *" }]
}
```

---

## Configurar webhook na Shopify

No painel da Shopify:
1. **Settings → Notifications → Webhooks**
2. **Create webhook**
   - Event: `Order payment`
   - Format: `JSON`
   - URL: `https://<seu-app>/webhooks/orders/paid`
   - API version: `2024-10`
3. Copie o **Signing secret** para a variável `SHOPIFY_WEBHOOK_SECRET`.

---

## Metafields dos produtos

Configure os metafields abaixo em cada produto que deve ter reposição ativada:

| Namespace | Key | Tipo | Descrição |
|---|---|---|---|
| `fdc_replenishment` | `enabled` | `boolean` | Ativa o lembrete para este produto |
| `fdc_replenishment` | `consumption_days` | `number_integer` | Dias estimados de consumo |
| `fdc_replenishment` | `reminder_delay_days` | `number_integer` | Dias após a compra para enviar o e-mail |
| `fdc_replenishment` | `source` | `single_line_text_field` | Identificador de origem (opcional) |

---

## API Admin

Todas as rotas requerem o header:

```
Authorization: Bearer <ADMIN_SECRET>
```

### `GET /admin/schedules`

Lista agendamentos com paginação.

Query params: `page`, `page_size`, `status`

```json
{
  "data": [...],
  "meta": { "page": 1, "page_size": 20, "total": 150, "total_pages": 8 }
}
```

### `GET /admin/schedules/:id/logs`

Retorna o histórico de eventos de um agendamento.

```json
{
  "data": [
    { "event": "scheduled", "details": { "trigger_date": "2025-02-15T..." }, "created_at": "..." },
    { "event": "sent", "details": null, "created_at": "..." }
  ]
}
```

---

## Template de e-mail

Edite `templates/replenishment-reminder.html` livremente.
As variáveis substituídas automaticamente são:

| Variável | Descrição |
|---|---|
| `{{customer_first_name}}` | Primeiro nome do cliente |
| `{{product_title}}` | Nome do produto |
| `{{product_url}}` | URL do produto na loja |
| `{{image_url}}` | URL da imagem do produto |
| `{{consumption_days}}` | Dias de consumo estimados |
| `{{shop_name}}` | Nome da loja |
| `{{unsubscribe_url}}` | Link para cancelar lembretes |

---

## Fluxo de processamento

```
Status inicial:  scheduled
                    ↓ (cron pega registros onde trigger_date <= NOW())
                processing
                    ↓
          ┌─────────────────────────┐
          │     Preflight checks    │
          └─────────────────────────┘
  e-mail inválido → skipped_no_email
  sem marketing  → skipped_no_consent
  produto inativo→ skipped_inactive_product
  sem estoque    → skipped_out_of_stock
  recomprou      → skipped_reordered
  tudo ok        → (envia e-mail)
                    ↓
              sent | failed
```

---

## Trocar provedor de e-mail

O arquivo `src/services/email.ts` usa o Resend. Para usar SendGrid ou Brevo,
substitua a função `sendReplenishmentEmail` mantendo a mesma assinatura.