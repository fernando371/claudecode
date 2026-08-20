# 08 — LGPD e segurança

## Princípio geral

Coletamos **o mínimo necessário**, guardamos pelo **menor tempo possível** e
mascaramos tudo que for dado pessoal.

---

## O que o sistema faz de LGPD

### Minimização

- O agente só pede o que precisa: número do pedido e e-mail **ou** telefone.
- Nunca pede CPF, dado de cartão ou informação médica.

### Dados de saúde são tratados como sensíveis

Quando o cliente menciona gravidez, doença, medicamento ou reação adversa, o
sistema **não guarda o texto clínico**. Guarda apenas:

- a marcação de que houve o gatilho (por exemplo, `gravidez_amamentacao`);
- um resumo curto **já mascarado**, para o atendente saber tratar com cuidado.

### Consentimento

Cada consentimento é registrado com **finalidade, origem, prova e data**.
As três finalidades são separadas:

| Finalidade | Exemplo                               | Precisa de aceite? |
| ---------- | ------------------------------------- | ------------------ |
| Serviço    | responder uma dúvida do cliente       | Não                |
| Utilidade  | avisar que o pedido foi faturado      | Sim                |
| Marketing  | carrinho abandonado, recompra, oferta | Sim                |

### Revogação

Palavras como "parar", "sair", "cancelar" e "não quero" revogam **na hora** os
consentimentos de marketing e utilidade e registram um pedido de interrupção.

### Exclusão

Pedidos de exclusão e interrupção ficam registrados e visíveis no painel.

### Retenção

Configurável no `.env` e exibida no painel:

| Item               | Padrão   |
| ------------------ | -------- |
| Conversas          | 180 dias |
| Auditoria          | 365 dias |
| Marcações de saúde | 30 dias  |

> **Pendência técnica:** hoje a política é configurável e exibida, mas o expurgo
> automático ainda não foi implementado. Está registrado em `STATUS-DO-PROJETO.md`.

### Mascaramento

E-mail, telefone, CPF, CNPJ, CEP e cartão são mascarados **automaticamente** em:

- logs do servidor
- trilha de auditoria
- telas do painel
- resumos enviados ao atendente

### Uso das conversas

As conversas dos clientes **não** são usadas para treinar nenhum modelo. Isso
exigiria autorização formal e não está previsto.

### Separação de ambientes

`dev`, `teste` e `producao` são separados por configuração. Em `dev` e `teste`, o
envio real é **sempre bloqueado**, independentemente de qualquer outra configuração.

---

## O que o sistema faz de segurança técnica

| Proteção                    | Como está implementada                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| Assinatura do webhook       | Validação `X-Hub-Signature-256` com comparação em tempo constante      |
| Webhook duplicado           | Cada mensagem é registrada; a segunda vez é ignorada                   |
| Limite de requisições       | Configurável (padrão: 60 por minuto)                                   |
| Validação de entrada        | Todo dado que entra passa por um esquema                               |
| Erros                       | Nunca devolvemos detalhe interno ao cliente                            |
| Segredos                    | Somente em variáveis de ambiente; nunca em código, log ou tela         |
| `.gitignore`                | Bloqueia `.env`, chaves, bancos e artefatos                            |
| Acesso ao painel            | Autenticação básica; **sem senha em produção o painel fica bloqueado** |
| Auditoria                   | Toda ação administrativa e todo escalonamento é registrado             |
| Acesso a pedido de terceiro | Verificação obrigatória; resposta idêntica para pedido inexistente     |
| Prompt injection            | Detecção na entrada + rede de proteção na saída                        |
| Vazamento entre conversas   | Cada conversa é isolada; o agente só acessa dados do cliente atual     |
| Tempo limite e disjuntor    | Todas as integrações externas                                          |
| Cabeçalhos HTTP             | `helmet` na API e cabeçalhos próprios no painel                        |
| CORS                        | Restrito à origem do painel                                            |
| Dependências                | `npm run audit:deps`                                                   |
| Verificação de segredos     | `npm run check:secrets` procura chaves no código                       |
| Modo de emergência          | Desligar IA, desligar WhatsApp, forçar atendimento humano              |

---

## Backups (para quando for para produção)

1. **Banco de dados:** cópia diária automática, com retenção de 30 dias, guardada
   em local diferente do servidor.
2. **Base de conhecimento:** já versionada no Git.
3. **Segredos:** guardados no cofre da hospedagem, com cópia em um gerenciador de
   senhas da empresa. **Nunca** em planilha, e-mail ou chat.
4. **Teste de restauração:** pelo menos uma vez por trimestre, restaurar um backup
   em ambiente de teste para confirmar que funciona.

---

## Sobre ferramentas de segurança

Este projeto usa **apenas** verificações defensivas e locais: auditoria de
dependências, análise estática, lint e busca de segredos no próprio código.
Não há e não haverá ferramentas ofensivas, nem qualquer varredura em sites,
domínios ou sistemas de terceiros.
