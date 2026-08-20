/**
 * Apoio dos testes: banco em memória, adaptadores simulados e
 * garantia de que nenhum envio real pode acontecer.
 */

process.env.APP_ENV = 'dev';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_FILE = ':memory:';
process.env.WHATSAPP_PROVIDER = 'mock';
process.env.CATALOG_PROVIDER = 'mock';
process.env.ORDER_PROVIDER = 'mock';
process.env.INVOICE_PROVIDER = 'mock';
process.env.TRACKING_PROVIDER = 'mock';
process.env.LLM_PROVIDER = 'mock';
process.env.WHATSAPP_LIVE_ENABLED = 'false';
process.env.OUTBOUND_CAMPAIGNS_ENABLED = 'false';
process.env.ADMIN_AUTH_ENABLED = 'false';

import {
  db,
  limparCacheConfig,
  limparEmergencia,
  limparEstadoConversas,
  limparCaixaDeSaidaSimulada,
  popular,
  processarMensagem,
  reiniciarCircuitos,
  simulacao,
} from '@fdc/core';
import type { RespostaAgente } from '@fdc/shared';

const TABELAS = [
  'notas_conversa',
  'mensagens',
  'conversas',
  'mensagens_processadas',
  'consentimentos',
  'fila_humana',
  'auditoria',
  'modelos_mensagem',
  'campanhas',
  'envios_campanha',
  'eventos_metricas',
  'pedidos_exclusao',
  'clientes',
];

/** Deixa o ambiente limpo antes de cada teste. */
export function prepararAmbiente(): void {
  limparCacheConfig();
  const conexao = db();
  for (const tabela of TABELAS) conexao.exec(`DELETE FROM ${tabela}`);
  simulacao.reiniciar();
  limparEmergencia();
  limparEstadoConversas();
  limparCaixaDeSaidaSimulada();
  reiniciarCircuitos();
  popular();
}

let contador = 0;

/** Envia uma mensagem ao agente como se fosse um cliente. */
export async function conversar(
  texto: string,
  opcoes: { remetente?: string; conversaId?: string; idExterno?: string } = {},
): Promise<RespostaAgente> {
  contador += 1;
  return processarMensagem({
    texto,
    canal: 'simulador',
    remetente: opcoes.remetente ?? '+5511900000001',
    ...(opcoes.conversaId ? { conversaId: opcoes.conversaId } : {}),
    ...(opcoes.idExterno ? { idExterno: opcoes.idExterno } : {}),
  });
}

export const CLIENTE_ANA = '+5511900000001';
export const EMAIL_ANA = 'ana.exemplo@exemplo.invalido';
export const CLIENTE_BRUNO = '+5511900000002';
export const EMAIL_BRUNO = 'bruno.exemplo@exemplo.invalido';
export const proximoId = () => `ext_${(contador += 1)}`;
