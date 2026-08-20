-- Esquema do banco local (SQLite) do prototipo FDC WhatsApp AI.
-- Todos os dados aqui sao FICTICIOS enquanto APP_ENV != producao.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clientes (
  id            TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL,
  telefone      TEXT NOT NULL,
  criado_em     TEXT NOT NULL,
  ficticio      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS conversas (
  id            TEXT PRIMARY KEY,
  cliente_id    TEXT NOT NULL,
  canal         TEXT NOT NULL,
  iniciada_em   TEXT NOT NULL,
  encerrada_em  TEXT,
  assumida_por  TEXT,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS mensagens (
  id                TEXT PRIMARY KEY,
  conversa_id       TEXT NOT NULL,
  direcao           TEXT NOT NULL CHECK (direcao IN ('entrada','saida')),
  texto             TEXT NOT NULL,
  intencao          TEXT,
  confianca         REAL,
  fontes            TEXT,
  regras            TEXT,
  escalonado        INTEGER NOT NULL DEFAULT 0,
  motivo_escalonamento TEXT,
  bloqueado_seguranca  INTEGER NOT NULL DEFAULT 0,
  duracao_ms        INTEGER,
  criado_em         TEXT NOT NULL,
  FOREIGN KEY (conversa_id) REFERENCES conversas(id)
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens(conversa_id);

-- Idempotencia de webhook: impede processar a mesma mensagem duas vezes.
CREATE TABLE IF NOT EXISTS mensagens_processadas (
  id_externo    TEXT PRIMARY KEY,
  canal         TEXT NOT NULL,
  processado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consentimentos (
  id            TEXT PRIMARY KEY,
  cliente_id    TEXT NOT NULL,
  finalidade    TEXT NOT NULL CHECK (finalidade IN ('servico','utilidade','marketing')),
  concedido     INTEGER NOT NULL,
  origem        TEXT NOT NULL,
  prova         TEXT NOT NULL,
  registrado_em TEXT NOT NULL,
  revogado_em   TEXT
);

CREATE INDEX IF NOT EXISTS idx_consent_cliente ON consentimentos(cliente_id, finalidade);

CREATE TABLE IF NOT EXISTS fila_humana (
  id            TEXT PRIMARY KEY,
  conversa_id   TEXT NOT NULL,
  cliente_id    TEXT NOT NULL,
  motivo        TEXT NOT NULL,
  resumo        TEXT NOT NULL,
  prioridade    TEXT NOT NULL DEFAULT 'normal',
  status        TEXT NOT NULL DEFAULT 'aberto',
  criado_em     TEXT NOT NULL,
  atendente     TEXT
);

CREATE TABLE IF NOT EXISTS auditoria (
  id            TEXT PRIMARY KEY,
  ocorrido_em   TEXT NOT NULL,
  ator          TEXT NOT NULL,
  acao          TEXT NOT NULL,
  recurso       TEXT NOT NULL,
  resultado     TEXT NOT NULL,
  detalhe       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auditoria_data ON auditoria(ocorrido_em);

-- Estrutura de campanhas: criada, porem DESLIGADA nesta fase.
CREATE TABLE IF NOT EXISTS modelos_mensagem (
  id            TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  categoria     TEXT NOT NULL CHECK (categoria IN ('servico','utilidade','marketing')),
  corpo         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'rascunho',
  criado_em     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campanhas (
  id            TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  modelo_id     TEXT NOT NULL,
  finalidade    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'rascunho',
  criado_em     TEXT NOT NULL,
  resultado     TEXT
);

CREATE TABLE IF NOT EXISTS envios_campanha (
  id            TEXT PRIMARY KEY,
  campanha_id   TEXT NOT NULL,
  cliente_id    TEXT NOT NULL,
  status        TEXT NOT NULL,
  motivo_bloqueio TEXT,
  criado_em     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eventos_metricas (
  id            TEXT PRIMARY KEY,
  tipo          TEXT NOT NULL,
  conversa_id   TEXT,
  valor_centavos INTEGER,
  detalhe       TEXT,
  criado_em     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metricas_tipo ON eventos_metricas(tipo);

CREATE TABLE IF NOT EXISTS pedidos_exclusao (
  id            TEXT PRIMARY KEY,
  cliente_id    TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('exclusao','interrupcao')),
  status        TEXT NOT NULL DEFAULT 'aberto',
  criado_em     TEXT NOT NULL,
  concluido_em  TEXT
);
