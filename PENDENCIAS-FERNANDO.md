# Pendências — Fernando

Lista curta do que **depende de você**. Nada aqui pode ser feito por mim sozinho.

> **Regra de ouro:** nunca envie senha, token, chave ou credencial pelo chat,
> e-mail ou WhatsApp. Eu te digo exatamente onde cadastrar cada coisa no arquivo
> `.env` do seu computador ou no cofre de segredos da hospedagem.

---

## 1. Aprovar o conteúdo oficial da FDC

- **O que é:** os textos que o agente pode usar para responder (rótulos dos produtos,
  FAQ, frete, prazos, trocas e devoluções, tom de voz, posicionamento das duas marcas).
- **Por que precisamos:** hoje esses arquivos são **modelos de exemplo**. O agente foi
  construído para **nunca inventar** informação: sem texto oficial aprovado, ele
  responde "não tenho essa informação confirmada" e transfere para um atendente.
- **Onde encontrar:** com o time de marketing, o responsável técnico dos produtos e
  o time de atendimento da FDC.
- **Custo:** nenhum.
- **Pode esperar?** Não. É o que mais limita a qualidade das respostas hoje.
- **Nunca envie pelo chat:** nada de sensível aqui, pode enviar os textos normalmente.
- **Próxima ação exata:** definir **uma pessoa responsável por aprovar** esses textos
  e me mandar o conteúdo do primeiro produto (composição, modo de uso e advertências,
  exatamente como está no rótulo).

---

## 1b. Combinações de produtos — RESOLVIDO

- **Decisão de 21/08/2026:** Fernando aprovou as 18 combinações levantadas da
  análise de co-compra de 250 pedidos pagos reais da loja.
- **Já está valendo**, inclusive em produção. Sua aprovação ficou registrada no
  cabeçalho do arquivo `data/knowledge/combinacoes-e-recompra.md`.
- **Revisar em fevereiro de 2027.** O padrão de compra muda; a análise deve ser
  refeita a cada seis meses. Eu refaço em minutos quando você pedir.

---

## 1c. Duração dos produtos — RESOLVIDO

- **Não precisou de você.** Vocês já tinham o campo `dias_de_uso` cadastrado em
  cada produto no Shopify. Peguei de lá: 45 produtos com a duração oficial.
- **Melhor ainda:** o sistema agora lê esse campo **direto da loja**. Quando
  alguém corrigir o cadastro no Shopify, o agente já responde certo — sem mexer
  em código, sem me chamar.
- A tabela no arquivo de combinações virou só um espelho, usada quando o catálogo
  não traz o dado e pelo simulador.

---

## 1d. Três kits com a duração errada no Shopify — PRECISA DE VOCÊ

- **O que é:** ao cruzar os kits com os frascos individuais, três cadastros estão
  com o `dias_de_uso` do frasco unitário em vez do kit inteiro:

  | Produto                                      | Está cadastrado | Deveria ser |
  | -------------------------------------------- | --------------- | ----------- |
  | Ômega-3 360 Cápsulas · Kit 3 Frascos         | 180 dias        | 540 dias    |
  | Ômega-3 360 Cápsulas · Kit Família 5 Frascos | 300 dias        | 900 dias    |
  | Ômega + CoQ10 · 2 unidades                   | 30 dias         | 60 dias     |

- **Por que precisamos:** isso **afeta o seu site**, não só este sistema. Quem
  compra o Kit Família de 5 frascos vê "300 dias de uso" quando na verdade são 900.
- **Onde corrigir:** no Shopify, no metacampo `dias_de_uso` de cada um desses três
  produtos.
- **Custo:** nenhum.
- **Pode esperar?** Não muito — é informação errada exibida ao cliente hoje.
- **Nunca envie pelo chat:** nada.
- **Próxima ação exata:** pedir para quem cuida do cadastro corrigir esses três.
  **Eu não alterei nada no Shopify** — só reportei. Se você me autorizar, eu corrijo.

---

## 2. Definir quem é o responsável técnico pela informação de saúde

- **O que é:** a pessoa (nutricionista, farmacêutico ou responsável técnico) que
  assina a aprovação de qualquer texto relacionado a produto e uso.
- **Por que precisamos:** cada documento da base tem um campo "aprovado por". Hoje
  está como "pendente".
- **Onde encontrar:** dentro da Biowell América.
- **Custo:** nenhum (ou horas internas).
- **Pode esperar?** Não, é pré-requisito do item 1.
- **Nunca envie pelo chat:** nada.
- **Próxima ação exata:** me informar o nome e o cargo dessa pessoa.

---

## 3. Acesso à Meta / WhatsApp Business Platform

- **O que é:** conta no Meta Business Manager, número de WhatsApp oficial verificado
  e um aplicativo criado na plataforma de desenvolvedores da Meta.
- **Por que precisamos:** é o que permite receber e enviar mensagens de verdade.
  **Enquanto não existir, o sistema roda 100% simulado — e isso está correto agora.**
- **Onde encontrar:** <https://business.facebook.com> (Business Manager) e
  <https://developers.facebook.com> (aplicativo e credenciais).
- **Custo:** **sim.** A Meta cobra por conversa/modelo de mensagem, com preço que
  varia por categoria e país. Não há custo enquanto nada estiver conectado.
- **Pode esperar?** Sim. Só é necessário quando decidirmos ir para o piloto real.
- **Nunca envie pelo chat:** o App Secret, o token de acesso e o token de verificação
  do webhook.
- **Próxima ação exata:** confirmar **se a FDC já tem** um número oficial de WhatsApp
  no Business Manager e quem é o administrador da conta.

---

## 4. Acesso de leitura ao Shopify

- **O que é:** um aplicativo privado no Shopify com permissão **somente de leitura**
  para produtos, estoque e pedidos.
- **Por que precisamos:** para o agente informar preço, disponibilidade e status de
  pedido reais. O sistema **nunca** altera nada no Shopify — só lê.
- **Onde encontrar:** painel do Shopify → **Configurações → Aplicativos e canais de
  vendas → Desenvolver apps**. Permissões: `read_products`, `read_inventory`,
  `read_orders`.
- **Custo:** nenhum (já está incluído no plano do Shopify).
- **Pode esperar?** Sim, mas é a integração de maior retorno e a mais simples.
- **Nunca envie pelo chat:** o token de acesso Admin API.
- **Próxima ação exata:** decidir se autoriza a criação desse aplicativo de leitura.

---

## 5. Informações do SAP (Nota Fiscal)

- **O que é:** como o SAP disponibiliza os dados de faturamento e Nota Fiscal.
- **Por que precisamos:** eu **não inventei** nenhum endereço ou formato do SAP.
  Criei apenas o contrato de integração; a implementação real depende dessas informações.
- **Onde encontrar:** com o responsável pelo SAP na Biowell ou com a empresa que faz
  a integração intermediária.
- **Custo:** possivelmente sim, se a integradora cobrar por desenvolvimento.
- **Pode esperar?** Sim. O agente já sabe dizer "a nota ainda não foi emitida" ou
  transferir para um atendente quando não consegue consultar.
- **Nunca envie pelo chat:** usuário, senha ou chave de acesso do SAP.
- **Próxima ação exata:** me dizer **quem** cuida do SAP e se existe ambiente de
  homologação. As perguntas exatas estão em `docs/14-perguntas-para-fornecedores.md`.

---

## 6. Informações das transportadoras

- **O que é:** documentação e credenciais da Mandaê, Correios, Fonteslog e TM Logística.
- **Por que precisamos:** para o rastreio real. Hoje o rastreio é simulado, mas as
  nove situações possíveis (de "aguardando coleta" a "extraviado") já estão implementadas.
- **Onde encontrar:** com o gerente de contas de cada transportadora.
- **Custo:** normalmente não, mas confirme com cada uma.
- **Pode esperar?** Sim.
- **Nunca envie pelo chat:** tokens e senhas de cada transportadora.
- **Próxima ação exata:** me dizer **quais transportadoras** são realmente usadas hoje
  e o volume aproximado de cada uma, para priorizarmos.

---

## 7. Decisão sobre o provedor de inteligência artificial

- **O que é:** se vamos usar a API da Anthropic (Claude) para gerar respostas mais
  naturais, ou manter o modo determinístico atual.
- **Por que precisamos:** hoje o agente responde com textos montados a partir das
  fontes oficiais, sem IA generativa. Funciona, é previsível e **não custa nada**.
- **Onde encontrar:** <https://console.anthropic.com>.
- **Custo:** **sim, e é separado.** Sua assinatura do Claude Code **não** inclui
  crédito de API. É uma contratação e uma cobrança à parte.
- **Pode esperar?** Sim. Recomendo decidir só depois de ver o simulador funcionando.
- **Nunca envie pelo chat:** a chave da API.
- **Próxima ação exata:** nenhuma agora. Só decida depois de testar o simulador.

---

## 8. Prazos de guarda dos dados (LGPD) — RESOLVIDO

- **Decisão de 20/08/2026:** conversas e trilha de auditoria em **365 dias**.
- **Marcações de saúde ficaram em 30 dias**, de propósito. Dado de saúde é sensível
  pela LGPD e a regra é guardar o mínimo: passados 30 dias, o texto do relato do
  cliente some e fica só o motivo (por exemplo, `reacao_adversa`), que é o que a
  operação realmente usa nas estatísticas.
- **Já está aplicado** e travado por teste automatizado.
- **Se você quis dizer 365 dias também para as marcações de saúde**, me avise: eu
  troco, mas recomendo manter os 30 dias.
- **Vale confirmar com o jurídico** quando houver oportunidade — a decisão é sua e
  a troca leva um minuto, é só configuração.

---

## 9. Autorização para versionar o projeto (Git)

- **O que é:** permissão para eu salvar o código no repositório do GitHub.
- **Por que precisamos:** o ambiente onde eu trabalho é temporário. Sem salvar no
  repositório, o trabalho se perde quando a sessão encerra.
- **Onde encontrar:** você já é o dono do repositório `fernando371/claudecode`.
- **Custo:** nenhum.
- **Pode esperar?** Já resolvido.
- **Nunca envie pelo chat:** nada.
- **Próxima ação exata:** já autorizado por você. Tudo está sendo salvo no branch
  `claude/fdc-whatsapp-ai-5a84t5` a cada entrega.
