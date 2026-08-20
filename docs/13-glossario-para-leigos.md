# 13 — Glossário para leigos

**Adaptador** — peça que conversa com um sistema de fora (Shopify, SAP, Meta).
Trocar de fornecedor significa trocar essa peça, não o sistema inteiro.

**API** — o "balcão" pelo qual dois sistemas conversam entre si.

**Auditoria** — registro de quem fez o quê e quando. Serve para investigar problemas.

**Base de conhecimento** — os textos oficiais que o agente pode usar para responder.

**Branch (Git)** — uma "via paralela" do projeto. O trabalho fica nela até ser aprovado.

**BSP** — empresa parceira que revende e opera o WhatsApp Business em nome da marca.

**Circuit breaker (disjuntor)** — quando uma integração falha várias vezes seguidas,
o sistema para de tentar por um tempo, para não travar tudo.

**Consentimento** — permissão do cliente para receber um tipo de mensagem.

**DANFE** — o documento em PDF que representa a Nota Fiscal eletrônica.

**Escalonamento** — passar a conversa para um atendente humano.

**Front-matter** — o cabeçalho no topo de cada documento da base de conhecimento,
com fonte, data, quem aprovou, status e data da próxima revisão.

**Idempotência** — garantia de que processar a mesma mensagem duas vezes não gera
duas respostas.

**Intenção** — o que o cliente quer (preço, rastreio, reclamação...).

**Janela de 24 horas** — regra da Meta: depois de 24h sem o cliente escrever, só é
possível iniciar conversa usando um modelo aprovado.

**LGPD** — a lei brasileira de proteção de dados pessoais.

**LLM** — o modelo de inteligência artificial que gera texto.

**Mascaramento** — esconder parte de um dado pessoal (ex.: `a***@empresa.com.br`).

**Metacampo (Shopify)** — campo extra do produto, onde guardamos o texto do rótulo.

**Mock (simulado)** — versão de mentirinha de uma integração, usada para testar sem
acessar o sistema real e sem custo.

**Modelo de mensagem (template)** — texto pré-aprovado pela Meta, obrigatório para
iniciar conversa.

**Monorepositório** — um só repositório contendo várias partes do sistema.

**Prompt injection** — quando alguém escreve uma mensagem tentando fazer a IA
desobedecer suas regras.

**Rate limit** — limite de quantas requisições são aceitas por minuto.

**SKU** — o código que identifica uma variação específica de produto.

**Timeout** — tempo máximo de espera por uma resposta antes de desistir.

**Trilha de auditoria** — a lista completa de eventos registrados.

**Variável de ambiente (.env)** — arquivo onde ficam as configurações e senhas do
sistema. **Nunca vai para o Git.**

**Webhook** — o endereço que a Meta chama toda vez que chega uma mensagem nova.
