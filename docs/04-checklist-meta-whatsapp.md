# 04 — Checklist Meta / WhatsApp

> **Nada disso é necessário agora.** O sistema funciona 100% simulado. Este
> documento serve para quando você decidir ir para o piloto real.

## Antes de começar

- [ ] Confirmar se a FDC **já tem** um número oficial de WhatsApp no Meta Business Manager.
- [ ] Confirmar quem é o **administrador** da conta.
- [ ] Decidir se o piloto usa um número novo ou o número atual do atendimento.

> Atenção: um número que já é usado no aplicativo **WhatsApp Business** comum precisa
> ser migrado para a plataforma. Durante a migração, o aplicativo deixa de funcionar
> nesse número. Planeje isso com o time de atendimento.

## Passo a passo

1. **Business Manager** — <https://business.facebook.com>
   - [ ] Conta comercial criada e verificada (verificação de negócio da Meta).
2. **Aplicativo** — <https://developers.facebook.com>
   - [ ] Criar um app do tipo "Business".
   - [ ] Adicionar o produto **WhatsApp**.
3. **Número**
   - [ ] Adicionar e verificar o número na conta do WhatsApp Business (WABA).
   - [ ] Definir nome de exibição e categoria.
4. **Credenciais** (cadastrar **somente** no `.env` ou no cofre da hospedagem)
   - [ ] `META_APP_SECRET` — em Configurações do app → Básico → Chave secreta.
   - [ ] `META_PHONE_NUMBER_ID` — na página do WhatsApp → Configuração da API.
   - [ ] `META_ACCESS_TOKEN` — token permanente de um usuário do sistema.
   - [ ] `META_WEBHOOK_VERIFY_TOKEN` — **você inventa** este texto; ele só precisa ser
         igual nos dois lados.
5. **Webhook**
   - [ ] Endereço público que aponte para `https://SEU-DOMINIO/webhooks/whatsapp`.
   - [ ] Assinar o campo `messages`.
   - [ ] Confirmar que a verificação passou (o sistema responde ao desafio da Meta).
6. **Modelos de mensagem**
   - [ ] Só necessários para **iniciar** conversa ou responder fora da janela de 24 horas.
   - [ ] Cada modelo precisa ser aprovado pela Meta na categoria correta
         (utilidade × marketing).

## Custos

A Meta cobra por conversa/modelo, com preço variável por categoria e país.
**Não existe custo enquanto nada estiver conectado.** Consulte a tabela oficial
antes de ligar qualquer envio.

## Trava de segurança do nosso lado

Mesmo com todas as credenciais cadastradas, **nenhuma mensagem real sai** enquanto
não forem verdadeiras, ao mesmo tempo:

```
APP_ENV=producao
WHATSAPP_PROVIDER=meta
WHATSAPP_ENABLED=true
WHATSAPP_LIVE_ENABLED=true
+ token e phone number id preenchidos
```

Isso é conferido por um teste automatizado. Ligar essa trava exige **autorização
expressa sua**.

## Nunca envie pelo chat

`META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`.
