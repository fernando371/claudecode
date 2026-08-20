import { contemAlgum, type Finalidade } from '@fdc/shared';
import { config } from '../config.js';
import { consentimentos, pedidosExclusao } from '../db/repositorios.js';

/**
 * Regras de LGPD aplicadas em tempo de execucao.
 */

/** Palavras que cancelam comunicacoes ativas imediatamente. */
export const PALAVRAS_DESCADASTRO = [
  'parar',
  'pare',
  'sair',
  'cancelar',
  'descadastrar',
  'nao quero',
  'não quero',
  'nao quero mais',
  'me tira',
  'me remove',
  'remover',
  'stop',
  'unsubscribe',
  'nao me mande',
  'para de mandar',
  'parar mensagens',
];

export function pediuDescadastro(texto: string): boolean {
  return contemAlgum(texto, PALAVRAS_DESCADASTRO);
}

/** Registra o pedido de parada e revoga o consentimento de marketing. */
export function processarDescadastro(clienteId: string): void {
  consentimentos.revogar(clienteId, 'marketing');
  consentimentos.revogar(clienteId, 'utilidade');
  pedidosExclusao.registrar(clienteId, 'interrupcao');
}

/** Envio ativo so acontece com consentimento valido para a finalidade. */
export function podeEnviarAtivo(
  clienteId: string,
  finalidade: Finalidade,
): {
  permitido: boolean;
  motivo: string;
} {
  const c = config();
  if (!c.OUTBOUND_CAMPAIGNS_ENABLED) {
    return { permitido: false, motivo: 'envio_ativo_desabilitado_nesta_fase' };
  }
  if (finalidade === 'servico') {
    return { permitido: true, motivo: 'mensagem_de_servico' };
  }
  if (!consentimentos.valido(clienteId, finalidade)) {
    return { permitido: false, motivo: 'sem_consentimento_valido' };
  }
  return { permitido: true, motivo: 'consentimento_valido' };
}

/**
 * Dados de saude sao sensiveis: nao guardamos o texto, apenas a marcacao
 * de que houve mencao, para o atendente humano saber tratar com cuidado.
 */
export function resumirSemDadoSensivel(texto: string): string {
  const limite = 160;
  const semNumerosLongos = texto.replace(/\d{6,}/g, '[numero]');
  return semNumerosLongos.length > limite
    ? `${semNumerosLongos.slice(0, limite)}...`
    : semNumerosLongos;
}

/** Politica de retencao configuravel, exibida no painel. */
export function politicaRetencao() {
  const c = config();
  return {
    conversasDias: c.RETENTION_CONVERSATIONS_DAYS,
    auditoriaDias: c.RETENTION_AUDIT_DAYS,
    marcacoesSaudeDias: c.RETENTION_HEALTH_FLAGS_DAYS,
    mascaramentoAtivo: c.PII_MASKING_ENABLED,
    ambiente: c.APP_ENV,
  };
}
