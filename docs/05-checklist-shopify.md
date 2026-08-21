# 05 — Checklist Shopify

> A integração é **somente leitura**. O sistema nunca altera produto, preço,
> estoque, conteúdo ou pedido na loja.

## Passo a passo

1. No painel do Shopify: **Configurações → Aplicativos e canais de vendas →
   Desenvolver apps → Criar um app**.
2. Nome sugerido: `FDC WhatsApp AI (leitura)`.
3. Em **Configurar escopos da API Admin**, marque **apenas**:
   - [ ] `read_products`
   - [ ] `read_inventory`
   - [ ] `read_orders`
4. Instale o app e copie o **token de acesso da Admin API**.
5. Cadastre no `.env` (nunca no chat, nunca no código):
   - [ ] `SHOPIFY_STORE_DOMAIN` (exemplo: `sua-loja.myshopify.com`)
   - [ ] `SHOPIFY_ADMIN_TOKEN`
   - [ ] `SHOPIFY_API_VERSION` (o sistema já vem com uma versão padrão configurável)
   - [ ] `SHOPIFY_STOREFRONT_BASE_URL` (endereço público da loja, para montar links)
6. Troque no `.env`: `CATALOG_PROVIDER=shopify` e `ORDER_PROVIDER=shopify`.

## Metacampos

### O que já existe na loja (verificado em 21/08/2026)

| Namespace | Chave         | Conteúdo                      | Situação                                                       |
| --------- | ------------- | ----------------------------- | -------------------------------------------------------------- |
| `custom`  | `dias_de_uso` | Dias que a embalagem dura     | **Preenchido na maioria dos produtos.** Já usado pelo sistema. |
| `custom`  | `quantidade`  | Ex.: "100 comprimidos"        | Preenchido                                                     |
| `udesly`  | `dias-de-uso` | Versão em texto do mesmo dado | Preenchido                                                     |

O sistema lê `custom.dias_de_uso` direto da loja. Quando vocês corrigem o cadastro,
o agente passa a responder certo sem ninguém mexer no código.

### O que ainda falta cadastrar

O agente só fala de composição, modo de uso e advertências com **texto oficial**.
Hoje esse conteúdo está solto dentro da descrição do produto, em texto corrido —
não dá para extrair com segurança. A recomendação é criar metacampos:

| Namespace | Chave                  | Conteúdo              |
| --------- | ---------------------- | --------------------- |
| `fdc`     | `composicao`           | Texto exato do rótulo |
| `fdc`     | `modo_de_uso`          | Texto exato do rótulo |
| `fdc`     | `advertencias`         | Texto exato do rótulo |
| `fdc`     | `porcao_por_embalagem` | Texto exato do rótulo |

Sem esses campos preenchidos, o agente responde que não tem a informação e
transfere para um atendente. **Isso é intencional.**

## Marcação das duas marcas

O sistema identifica a marca pelo campo **fornecedor (vendor)** do produto:
quem contiver "Nutrition" é tratado como FDC Nutrition; o restante, como FDC Vitaminas.

- [ ] Confirmar se o campo "fornecedor" está preenchido corretamente nos produtos.

## Link de carrinho

O link de carrinho do Shopify usa o **ID da variante**, não o SKU. A conversão será
implementada quando as credenciais existirem — hoje essa função devolve
"não habilitado" em vez de gerar um link errado.

## Custo

Nenhum custo adicional: já está incluído no seu plano do Shopify.

## Nunca envie pelo chat

`SHOPIFY_ADMIN_TOKEN`.
