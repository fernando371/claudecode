# 10 — Plano de implantação

> Nenhuma etapa abaixo pode ser executada sem **autorização expressa sua**.

## Etapa 0 — Hoje (concluída)

Protótipo rodando no computador, com dados fictícios e sem custo.

## Etapa 1 — Conteúdo oficial (sem custo, sem integração)

1. Definir o responsável técnico que aprova a informação de saúde.
2. Preencher e aprovar a base de conhecimento (rótulos, FAQ, frete, trocas, tom de voz).
3. Rodar a homologação manual do `docs/09-testes-e-homologacao.md`.

**Decisão ao fim:** as respostas ficaram boas o bastante para atender um cliente real?

## Etapa 2 — Shopify em leitura (custo zero)

1. Criar o app privado de leitura no Shopify.
2. Cadastrar as credenciais no `.env`.
3. Testar preço, estoque e status de pedido com **pedidos reais seus**, ainda pelo simulador.

**Decisão ao fim:** os dados batem com o painel do Shopify?

## Etapa 3 — Infraestrutura (primeiro custo recorrente)

1. Escolher a hospedagem.
2. Migrar o banco de SQLite para **PostgreSQL**.
3. Configurar o cofre de segredos da hospedagem.
4. Configurar backup diário e testar a restauração.
5. Definir domínio e certificado HTTPS.
6. Definir a senha do painel (`ADMIN_PASSWORD`) — **sem ela o painel fica bloqueado
   em produção, de propósito**.

## Etapa 4 — WhatsApp em modo recebimento (custo baixo)

1. Concluir o checklist da Meta (`docs/04-checklist-meta-whatsapp.md`).
2. Apontar o webhook para o servidor.
3. Manter `WHATSAPP_LIVE_ENABLED=false`: o sistema **recebe** e processa, mas
   **não responde**. As respostas ficam visíveis no painel.
4. Rodar assim por alguns dias e revisar o que o agente **teria** respondido.

**Decisão ao fim:** as respostas estão seguras o bastante para irem ao cliente?

## Etapa 5 — Piloto real controlado

1. Ligar `WHATSAPP_LIVE_ENABLED=true` (**exige sua autorização expressa**).
2. Começar com horário limitado e com um atendente acompanhando o painel.
3. Revisar a fila de atendimento humano todos os dias.
4. Acompanhar os indicadores e a planilha de ROI.

## Etapa 6 — Expansão (somente se o ROI justificar)

- SAP / Nota Fiscal.
- Rastreio real das transportadoras.
- Carrinho abandonado e recompra (com consentimento e modelos aprovados).
- Instagram e outros canais.
- IA generativa, se a qualidade das respostas justificar o custo.

---

## Critério de continuidade

> O projeto só deve avançar para operação completa se os ganhos incrementais e as
> economias justificarem o custo recorrente, com expectativa realista de retorno da
> implantação em **até seis meses**.

Use `data/financeiro/modelo-roi.csv` para fazer essa conta.
