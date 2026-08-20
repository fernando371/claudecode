# Status do projeto — FDC WhatsApp AI

Atualizado em **20/08/2026**. Fase: **protótipo com dados fictícios**.

---

## Já funciona (testado)

### Agente de conversa

- Recebe a mensagem, identifica o cliente e o canal, classifica a intenção
  (21 intenções), consulta só as fontes necessárias e responde.
- Responde sobre **preço, disponibilidade, composição, modo de uso e comparação**
  de produtos usando apenas dados oficiais do catálogo.
- Consulta **pedido, Nota Fiscal, rastreio e prazo** — só depois de confirmar a
  identidade do cliente.
- Identifica **possível atraso** comparando prazo prometido, faturamento, coleta e
  última movimentação.
- Gera link de produto e de carrinho, inclusive **misturando FDC Vitaminas e FDC Nutrition**.
- **Carrinho abandonado:** mostra o carrinho do cliente e o link para retomar, quando
  ele pergunta. Identidade vem do número do WhatsApp; devolve só nome dos produtos.
- **Recompra:** compara a data da última compra com a duração estimada do rótulo e
  oferece reposição do que já deve estar acabando.
- **Cross-sell:** sugere combinações que estejam na tabela aprovada, nunca inventadas,
  nunca personalizadas por informação de saúde, e nunca em cima de pergunta objetiva.
- Registra motivo de contato, transfere para atendente e alimenta os indicadores.

### Segurança para suplementos

- Nunca diagnostica, prescreve nem promete resultado.
- Transfere automaticamente para humano quando aparece: gravidez, amamentação,
  criança, doença, medicamento, alergia, reação adversa, superdosagem, produto
  alterado ou suspeita de falsificação, dúvida clínica.
- Rede de proteção na saída: se a resposta gerada contiver frase proibida, ela é
  bloqueada antes de sair.

### Privacidade (LGPD)

- Mascaramento de e-mail, telefone, CPF, CNPJ, CEP e cartão em **logs, painel e
  trilha de auditoria**.
- Consentimento registrado com finalidade, origem, prova e data.
- Palavras como "parar", "sair" e "não quero" revogam o consentimento na hora.
- Registro de pedidos de exclusão e interrupção.
- Política de retenção configurável, **aplicada automaticamente**: o expurgo roda ao
  iniciar o sistema e a cada 24 horas, e também sob demanda pelo painel.
- Dados sensíveis de saúde recebem prazo mais curto: o texto do relato é apagado
  primeiro, mantendo só o motivo para estatística.
- **Direitos do titular executados pelo painel:** parar comunicações e excluir os
  dados (apaga conversas e anonimiza o cadastro, com confirmação em duas etapas).

### Segurança técnica

- Validação da assinatura `X-Hub-Signature-256` do webhook da Meta.
- Proteção contra webhook duplicado (idempotência).
- Limite de requisições separado por rota (webhook público apertado, painel autenticado com folga), validação de entrada, tratamento seguro de erros,
  cabeçalhos HTTP de segurança e CORS restrito.
- Proteção contra prompt injection, pedido de segredo, pedido de dados de terceiros
  e tentativa de execução de código.
- Lista **fechada** de ferramentas: a IA nunca chama Shopify, SAP ou transportadora
  diretamente.
- Tempo limite e disjuntor (circuit breaker) em todas as integrações.
- Controle de acesso no painel; em produção, sem senha definida o painel fica bloqueado.
- Modo de emergência: desligar a IA, desligar o WhatsApp ou forçar atendimento
  somente humano — com efeito imediato.

### Atendimento humano

- Fila com motivo, prioridade e situação de cada conversa transferida.
- Tela de atendimento: a pessoa **lê o histórico completo** (com dados pessoais
  mascarados), vê **por que** a conversa foi transferida e **responde o cliente**.
- Anotações internas da equipe, que **nunca** são enviadas ao cliente.
- Enquanto a conversa está com uma pessoa, a IA fica em silêncio; ao encerrar,
  a conversa volta para o agente automático.
- A resposta humana também respeita a trava de envio real do WhatsApp.
- Toda resposta, anotação e encerramento fica registrado na auditoria.
- Indicadores: espera até a primeira resposta humana e total de respostas de atendentes.

### Painel e simulador

- **Simulador de Conversas** com cliente fictício, pedido fictício, diagnóstico da
  resposta (intenção, fontes, regras, transferência) e botões para simular falhas de
  Shopify, SAP e transportadora.
- O simulador mostra as respostas escritas por atendentes, permitindo testar o
  atendimento humano de ponta a ponta sem sair do computador.
- Telas: visão geral, conversas, base de conhecimento, produtos, pedidos, fila de
  atendimento humano, indicadores, consentimentos, auditoria, status das integrações
  e configurações.

### Qualidade

- **149 testes automatizados** passando, incluindo os 25 cenários obrigatórios.
- **13 testes de navegador** (`npm run test:e2e`) percorrendo o painel de verdade,
  incluindo o atendimento humano de ponta a ponta.
- Verificação de tipos, lint, formatação e verificação de segredos, todos limpos.
- Nenhum teste depende de credencial, internet ou serviço pago.

---

## Preparado, porém desligado

| Item                      | Situação                                                |
| ------------------------- | ------------------------------------------------------- |
| WhatsApp (Meta Cloud API) | Adaptador pronto. Envio real bloqueado por trava dupla. |
| Shopify — catálogo        | Adaptador de leitura pronto. Sem credenciais.           |
| Shopify — pedidos         | Adaptador de leitura pronto. Sem credenciais.           |
| SAP / Nota Fiscal         | Só o contrato. Implementação depende de documentação.   |
| Transportadoras           | Só os contratos. Nenhuma API foi inventada.             |
| IA generativa (Anthropic) | Adaptador pronto. Desligado sem chave.                  |
| Campanhas / envio ativo   | Estrutura criada. Disparo bloqueado nesta fase.         |

---

## Ainda falta

### Depende de você (ver `PENDENCIAS-FERNANDO.md`)

1. Conteúdo oficial da FDC aprovado (rótulos, FAQ, frete, trocas, combinações).
2. Responsável técnico que aprova a informação de saúde.
3. Decisão sobre acesso à Meta, ao Shopify, ao SAP e às transportadoras.
4. Autorização para salvar o projeto no Git.

### Depende de decisão técnica futura

- Migrar o banco de SQLite para PostgreSQL na ida para produção (ADR 0002).
- Gerar pacote compilado ou imagem Docker para produção (ADR 0003).
- Fila de processamento dedicada quando o volume de mensagens crescer.
- Autenticação do painel com usuários individuais (hoje é um acesso único e o nome
  do atendente é digitado à mão).

---

## Riscos conhecidos

| Risco                                       | Gravidade | Como está tratado                                                                                                                  |
| ------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Agente dar informação errada sobre saúde    | Alta      | Bloqueio na entrada e na saída; transferência obrigatória; sem fonte oficial ele não responde.                                     |
| Cliente acessar pedido de outra pessoa      | Alta      | Verificação de identidade obrigatória; resposta idêntica para pedido inexistente e dados errados (evita descoberta por tentativa). |
| Envio real acidental pelo WhatsApp          | Alta      | Trava dupla: exige produção **e** variável explícita. Testado.                                                                     |
| Conteúdo oficial ainda não aprovado         | Alta      | O agente admite que não sabe e transfere. Depende do item 1 das pendências.                                                        |
| Vazamento de dado pessoal em log            | Média     | Mascaramento automático em todo log e tela.                                                                                        |
| Integração fora do ar gerar resposta errada | Média     | Nunca usamos dado inventado: informamos indisponibilidade e transferimos.                                                          |
| Regras de marketplace (Mercado Livre)       | Média     | Nenhum fluxo de desvio foi criado. Uso para marketplace está desabilitado.                                                         |
| Custo da Meta e da API de IA                | Média     | Nada conectado, custo zero hoje. Planilha de ROI criada para decidir antes de ligar.                                               |
