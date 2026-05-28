# claudecode

Repositório de configuração do Claude Code.

## Arquivos

- `CLAUDE.md` — regras de sessão, custo e contexto para o assistente.

---

# Shopify Coupon Orders Bot

Envia diariamente um relatório HTML por email com todos os pedidos que utilizaram cupom na loja FDC Vitaminas.

## Como funciona

Roda via **GitHub Actions** todo dia às **08:00 BRT**. Consulta a Shopify Admin API, filtra pedidos do dia anterior com cupom, e envia email para `comercial@biowellamerica.com.br`.

## Configuração

### 1. Criar App Privado no Shopify

1. Acesse: `Configurações → Aplicativos → Desenvolver apps`
2. Crie um app com permissão: `read_orders`
3. Copie o **token de acesso Admin API**

### 2. Configurar Secrets no GitHub

`Settings → Secrets and variables → Actions → New repository secret`:

| Secret | Valor |
|---|---|
| `SHOPIFY_STORE_URL` | `fdc.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Token do app privado |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Seu email Gmail |
| `SMTP_PASSWORD` | Senha de App do Gmail (não a senha normal) |
| `EMAIL_FROM` | Mesmo email do SMTP_USER |

> **Gmail:** ative 2FA e gere uma Senha de App em myaccount.google.com/apppasswords

### 3. Rodar manualmente

Na aba **Actions** → `Daily Coupon Orders Report` → **Run workflow**.