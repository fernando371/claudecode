# FDC WhatsApp AI — comece por aqui

Sistema de atendimento, vendas e pós-venda pelo WhatsApp para a **FDC Vitaminas**
(Biowell América).

> **Estado atual: protótipo.** Tudo funciona com dados fictícios e integrações
> simuladas. **Nenhuma mensagem real é enviada. Nenhum sistema de produção é
> acessado.** Shopify, SAP, Meta e transportadoras estão preparados, porém
> desligados.

---

## Como abrir o sistema no seu computador

Você precisa ter o **Node.js versão 22 ou superior** instalado
(baixe em <https://nodejs.org> — escolha a opção "LTS").

Abra o terminal na pasta do projeto e rode, na ordem:

```bash
npm install
npm run setup
npm run dev
```

Depois é só abrir no navegador:

| O quê                       | Endereço                     |
| --------------------------- | ---------------------------- |
| **Painel e Simulador**      | <http://localhost:3000>      |
| API (para desenvolvedores)  | <http://localhost:3333>      |
| Documentação técnica da API | <http://localhost:3333/docs> |

Para parar, aperte `Ctrl + C` no terminal.

---

## O que dá para fazer agora

1. Abrir o **Simulador de Conversas** e conversar com o agente como se fosse um cliente.
2. Ver o agente tratar carrinho abandonado, recompra e sugestão de combinação.
3. Testar situações difíceis com um clique: cliente grávida, reação adversa,
   pedido atrasado, pedido extraviado, Shopify fora do ar, SAP fora do ar,
   tentativa de acessar pedido de outra pessoa, tentativa de burlar o agente.
4. Ver, em cada resposta, **qual intenção foi detectada, quais fontes foram usadas,
   quais regras foram acionadas** e se houve transferência para atendente.
5. Acompanhar a fila de atendimento humano e, dentro dela, **abrir a conversa, ler o
   histórico e responder o cliente como atendente**.
6. Acompanhar os indicadores e a trilha de auditoria.
7. Atender pedidos de LGPD: parar comunicações de um cliente ou excluir os dados dele.
8. Desligar a IA ou o WhatsApp na hora, pelo painel (modo de emergência).

---

## Comandos úteis

| Comando              | O que faz                                                      |
| -------------------- | -------------------------------------------------------------- |
| `npm run dev`        | Liga o painel e a API                                          |
| `npm test`           | Roda os 105 testes automatizados                               |
| `npm run build`      | Confere o projeto inteiro e compila o painel                   |
| `npm run check:all`  | Roda formatação, lint, tipos, testes e verificação de segredos |
| `npm run db:reset`   | Recria os dados fictícios de demonstração                      |
| `npm run audit:deps` | Audita as dependências do projeto                              |

---

## Documentação

Leia primeiro:

- **[STATUS-DO-PROJETO.md](STATUS-DO-PROJETO.md)** — o que já funciona e o que falta.
- **[PENDENCIAS-FERNANDO.md](PENDENCIAS-FERNANDO.md)** — o que depende só de você.

Depois, conforme a necessidade:

| Documento                                                                                  | Assunto                           |
| ------------------------------------------------------------------------------------------ | --------------------------------- |
| [docs/01-escopo-do-piloto.md](docs/01-escopo-do-piloto.md)                                 | O que entra e o que não entra     |
| [docs/02-arquitetura-em-linguagem-simples.md](docs/02-arquitetura-em-linguagem-simples.md) | Como o sistema é montado          |
| [docs/03-fluxos-de-conversa.md](docs/03-fluxos-de-conversa.md)                             | O passo a passo do agente         |
| [docs/04-checklist-meta-whatsapp.md](docs/04-checklist-meta-whatsapp.md)                   | Meta / WhatsApp                   |
| [docs/05-checklist-shopify.md](docs/05-checklist-shopify.md)                               | Shopify                           |
| [docs/06-checklist-sap.md](docs/06-checklist-sap.md)                                       | SAP e Nota Fiscal                 |
| [docs/07-checklist-logistica.md](docs/07-checklist-logistica.md)                           | Transportadoras                   |
| [docs/08-lgpd-e-seguranca.md](docs/08-lgpd-e-seguranca.md)                                 | Privacidade e segurança           |
| [docs/09-testes-e-homologacao.md](docs/09-testes-e-homologacao.md)                         | Como testamos                     |
| [docs/10-plano-de-implantacao.md](docs/10-plano-de-implantacao.md)                         | Como colocar no ar                |
| [docs/11-plano-de-emergencia.md](docs/11-plano-de-emergencia.md)                           | Se algo der errado                |
| [docs/12-metricas-e-roi.md](docs/12-metricas-e-roi.md)                                     | Como medir se vale a pena         |
| [docs/13-glossario-para-leigos.md](docs/13-glossario-para-leigos.md)                       | Dicionário de termos              |
| [docs/14-perguntas-para-fornecedores.md](docs/14-perguntas-para-fornecedores.md)           | O que perguntar a cada fornecedor |

Decisões técnicas explicadas: [docs/adr/](docs/adr/)

---

## Regra de ouro sobre segredos

Senhas, tokens e chaves ficam **somente** no arquivo `.env` do seu computador
(ou no cofre de segredos da hospedagem). Esse arquivo **nunca** vai para o Git.

**Nunca envie chave, token ou senha por chat, e-mail ou WhatsApp.**

---

---

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

| Secret                 | Valor                                      |
| ---------------------- | ------------------------------------------ |
| `SHOPIFY_STORE_URL`    | `fdc.myshopify.com`                        |
| `SHOPIFY_ACCESS_TOKEN` | Token do app privado                       |
| `SMTP_HOST`            | `smtp.gmail.com`                           |
| `SMTP_PORT`            | `587`                                      |
| `SMTP_USER`            | Seu email Gmail                            |
| `SMTP_PASSWORD`        | Senha de App do Gmail (não a senha normal) |
| `EMAIL_FROM`           | Mesmo email do SMTP_USER                   |

> **Gmail:** ative 2FA e gere uma Senha de App em myaccount.google.com/apppasswords

### 3. Rodar manualmente

Na aba **Actions** → `Daily Coupon Orders Report` → **Run workflow**.
