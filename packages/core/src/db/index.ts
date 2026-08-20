import type { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { doProjeto } from '../caminhos.js';

const PASTA_ATUAL = dirname(fileURLToPath(import.meta.url));

// Carregado em tempo de execucao: 'node:sqlite' e um modulo nativo do Node 22+
// e alguns empacotadores tentam resolver o import estatico como pacote npm.
const requerer = createRequire(import.meta.url);
const { DatabaseSync: Sqlite } = requerer('node:sqlite') as typeof import('node:sqlite');

let instancia: DatabaseSync | null = null;
let caminhoAtual: string | null = null;

export function caminhoBanco(): string {
  const arquivo = config().DATABASE_FILE;
  // ':memory:' e um banco temporario na memoria, usado pelos testes.
  if (arquivo === ':memory:') return ':memory:';
  return doProjeto(arquivo);
}

/** Abre (ou reaproveita) a conexao com o banco local e garante o esquema. */
export function db(caminho?: string): DatabaseSync {
  const alvo = caminho ?? caminhoBanco();
  if (instancia && caminhoAtual === alvo) return instancia;
  if (instancia) instancia.close();

  if (alvo !== ':memory:') mkdirSync(dirname(alvo), { recursive: true });
  const conexao = new Sqlite(alvo);
  const sql = readFileSync(resolve(PASTA_ATUAL, 'schema.sql'), 'utf8');
  conexao.exec(sql);
  instancia = conexao;
  caminhoAtual = alvo;
  return conexao;
}

/** Banco isolado em memoria: usado pelos testes automatizados. */
export function bancoEmMemoria(): DatabaseSync {
  return db(':memory:');
}

export function fecharBanco(): void {
  if (instancia) instancia.close();
  instancia = null;
  caminhoAtual = null;
}

export function agora(): string {
  return new Date().toISOString();
}

let contador = 0;
export function novoId(prefixo: string): string {
  contador += 1;
  const aleatorio = Math.random().toString(36).slice(2, 8);
  return `${prefixo}_${Date.now().toString(36)}${contador.toString(36)}${aleatorio}`;
}
