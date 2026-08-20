import { agora, db } from '../db/index.js';
import { auditoria, metricas } from '../db/repositorios.js';
import { config } from '../config.js';
import { log } from '../logger.js';

/**
 * EXPURGO AUTOMÁTICO PELA POLÍTICA DE RETENÇÃO (LGPD).
 *
 * A LGPD manda guardar dado pessoal só pelo tempo necessário. Este módulo
 * apaga o que passou do prazo, sem tocar no que ainda está dentro dele.
 *
 * Três prazos independentes, todos configuráveis no .env:
 *   - conversas e mensagens        (RETENTION_CONVERSATIONS_DAYS)
 *   - trilha de auditoria          (RETENTION_AUDIT_DAYS)
 *   - marcações de saúde na fila   (RETENTION_HEALTH_FLAGS_DAYS)
 *
 * As marcações de saúde recebem tratamento mais rígido porque são dados
 * sensíveis: o texto do relato é apagado antes de tudo, e só o motivo do
 * escalonamento permanece — o suficiente para estatística, sem o conteúdo.
 */

export const TEXTO_REMOVIDO = '[removido pela política de retenção]';

/** Motivos de escalonamento que envolvem informação de saúde. */
const MOTIVOS_SENSIVEIS = [
  'gravidez_amamentacao',
  'crianca',
  'condicao_clinica',
  'uso_medicamento',
  'alergia',
  'reacao_adversa',
  'superdosagem',
  'duvida_clinica',
];

export interface RelatorioExpurgo {
  executadoEm: string;
  conversasApagadas: number;
  mensagensApagadas: number;
  notasApagadas: number;
  eventosAuditoriaApagados: number;
  relatosSensiveisRemovidos: number;
  webhooksAntigosApagados: number;
  prazos: {
    conversasDias: number;
    auditoriaDias: number;
    marcacoesSaudeDias: number;
  };
}

function limite(dias: number, referencia: number): string {
  return new Date(referencia - dias * 24 * 3600 * 1000).toISOString();
}

function contar(sql: string, ...parametros: string[]): number {
  const linha = db()
    .prepare(sql)
    .get(...parametros) as { total?: number } | undefined;
  return Number(linha?.total ?? 0);
}

/**
 * Executa o expurgo. Pode ser chamado quantas vezes quiser: só remove o que
 * já passou do prazo, então rodar duas vezes seguidas não causa problema.
 */
export function executarExpurgo(referencia: number = Date.now()): RelatorioExpurgo {
  const c = config();
  const conexao = db();

  const limiteConversas = limite(c.RETENTION_CONVERSATIONS_DAYS, referencia);
  const limiteAuditoria = limite(c.RETENTION_AUDIT_DAYS, referencia);
  const limiteSaude = limite(c.RETENTION_HEALTH_FLAGS_DAYS, referencia);

  // --- 1. Dados sensíveis de saúde: apagamos o relato, mantemos o motivo ----
  const marcadores = MOTIVOS_SENSIVEIS.map(() => '?').join(',');
  const relatosSensiveisRemovidos = contar(
    `SELECT COUNT(*) as total FROM fila_humana
     WHERE criado_em < ? AND motivo IN (${marcadores}) AND resumo <> ?`,
    limiteSaude,
    ...MOTIVOS_SENSIVEIS,
    TEXTO_REMOVIDO,
  );
  conexao
    .prepare(
      `UPDATE fila_humana SET resumo = ?
       WHERE criado_em < ? AND motivo IN (${marcadores}) AND resumo <> ?`,
    )
    .run(TEXTO_REMOVIDO, limiteSaude, ...MOTIVOS_SENSIVEIS, TEXTO_REMOVIDO);

  // --- 2. Conversas fora do prazo ------------------------------------------
  const conversasAlvo = conexao
    .prepare('SELECT id FROM conversas WHERE iniciada_em < ?')
    .all(limiteConversas) as Array<{ id: string }>;

  let mensagensApagadas = 0;
  let notasApagadas = 0;

  for (const { id } of conversasAlvo) {
    mensagensApagadas += contar(
      'SELECT COUNT(*) as total FROM mensagens WHERE conversa_id = ?',
      id,
    );
    notasApagadas += contar(
      'SELECT COUNT(*) as total FROM notas_conversa WHERE conversa_id = ?',
      id,
    );
    conexao.prepare('DELETE FROM notas_conversa WHERE conversa_id = ?').run(id);
    conexao.prepare('DELETE FROM mensagens WHERE conversa_id = ?').run(id);
    conexao.prepare('DELETE FROM fila_humana WHERE conversa_id = ?').run(id);
    conexao.prepare('DELETE FROM conversas WHERE id = ?').run(id);
  }

  // --- 3. Trilha de auditoria fora do prazo --------------------------------
  const eventosAuditoriaApagados = contar(
    'SELECT COUNT(*) as total FROM auditoria WHERE ocorrido_em < ?',
    limiteAuditoria,
  );
  conexao.prepare('DELETE FROM auditoria WHERE ocorrido_em < ?').run(limiteAuditoria);

  // --- 4. Registro de webhooks já processados ------------------------------
  // Serve só para evitar mensagem duplicada; depois do prazo das conversas
  // não tem mais utilidade.
  const webhooksAntigosApagados = contar(
    'SELECT COUNT(*) as total FROM mensagens_processadas WHERE processado_em < ?',
    limiteConversas,
  );
  conexao.prepare('DELETE FROM mensagens_processadas WHERE processado_em < ?').run(limiteConversas);

  const relatorio: RelatorioExpurgo = {
    executadoEm: agora(),
    conversasApagadas: conversasAlvo.length,
    mensagensApagadas,
    notasApagadas,
    eventosAuditoriaApagados,
    relatosSensiveisRemovidos,
    webhooksAntigosApagados,
    prazos: {
      conversasDias: c.RETENTION_CONVERSATIONS_DAYS,
      auditoriaDias: c.RETENTION_AUDIT_DAYS,
      marcacoesSaudeDias: c.RETENTION_HEALTH_FLAGS_DAYS,
    },
  };

  const removeuAlgo =
    relatorio.conversasApagadas +
      relatorio.eventosAuditoriaApagados +
      relatorio.relatosSensiveisRemovidos +
      relatorio.webhooksAntigosApagados >
    0;

  // O registro do expurgo é gravado DEPOIS da limpeza, para não ser apagado
  // por ele mesmo.
  auditoria.registrar({
    ator: 'sistema',
    acao: 'lgpd:expurgo_por_retencao',
    recurso: 'banco_de_dados',
    resultado: 'permitido',
    detalhe: `${relatorio.conversasApagadas} conversas, ${relatorio.mensagensApagadas} mensagens, ${relatorio.eventosAuditoriaApagados} eventos, ${relatorio.relatosSensiveisRemovidos} relatos sensíveis`,
  });
  if (removeuAlgo) {
    metricas.registrar('expurgo_executado', { detalhe: String(relatorio.conversasApagadas) });
    log.info('expurgo por retencao executado', {
      conversas: relatorio.conversasApagadas,
      eventos: relatorio.eventosAuditoriaApagados,
    });
  }

  return relatorio;
}

let agendador: NodeJS.Timeout | null = null;

/**
 * Agenda o expurgo para rodar de tempos em tempos (padrão: a cada 24 horas)
 * e executa uma vez na inicialização.
 */
export function agendarExpurgo(intervaloMs = 24 * 3600 * 1000): RelatorioExpurgo {
  pararExpurgoAgendado();
  const primeiro = executarExpurgo();
  agendador = setInterval(() => {
    try {
      executarExpurgo();
    } catch (erro) {
      log.error('falha no expurgo agendado', { erro: String(erro) });
    }
  }, intervaloMs);
  agendador.unref?.();
  return primeiro;
}

export function pararExpurgoAgendado(): void {
  if (agendador) clearInterval(agendador);
  agendador = null;
}
