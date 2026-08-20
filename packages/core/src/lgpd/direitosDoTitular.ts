import { falha, ok, type Resultado } from '@fdc/shared';
import { agora, db } from '../db/index.js';
import {
  auditoria,
  clientes,
  consentimentos,
  metricas,
  pedidosExclusao,
} from '../db/repositorios.js';
import { log } from '../logger.js';

/**
 * DIREITOS DO TITULAR (LGPD, art. 18).
 *
 * Registrar um pedido já existia. Aqui a gente **executa** o pedido:
 *
 *  - Interrupção: para de mandar mensagem de campanha para a pessoa.
 *  - Exclusão: apaga o histórico de conversa e anonimiza o cadastro.
 *
 * O que NÃO é apagado, de propósito:
 *  - A trilha de auditoria, que é a prova de que o pedido foi cumprido.
 *    Ela já é gravada mascarada, sem dado pessoal por inteiro.
 *  - O registro do próprio pedido de exclusão.
 *  Guardar essas duas coisas é o que permite demonstrar cumprimento depois.
 */

export interface RelatorioExclusao {
  clienteId: string;
  conversasApagadas: number;
  mensagensApagadas: number;
  notasApagadas: number;
  itensDeFilaApagados: number;
  consentimentosRevogados: number;
  cadastroAnonimizado: boolean;
  executadoEm: string;
}

export const NOME_ANONIMIZADO = '[titular removido a pedido]';

function contar(sql: string, ...parametros: string[]): number {
  const linha = db()
    .prepare(sql)
    .get(...parametros) as { total?: number } | undefined;
  return Number(linha?.total ?? 0);
}

/**
 * Executa a exclusão dos dados de um cliente.
 * Idempotente: rodar de novo em alguém já excluído não quebra nada.
 */
export function executarExclusao(
  clienteId: string,
  solicitante = 'painel',
): Resultado<RelatorioExclusao> {
  const cliente = clientes.porId(clienteId);
  if (!cliente) {
    return falha({
      codigo: 'nao_encontrado',
      mensagem: 'Cliente não encontrado.',
      origem: 'lgpd',
    });
  }

  const conexao = db();
  const conversasAlvo = conexao
    .prepare('SELECT id FROM conversas WHERE cliente_id = ?')
    .all(clienteId) as Array<{ id: string }>;

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
    conexao.prepare('DELETE FROM conversas WHERE id = ?').run(id);
  }

  const itensDeFilaApagados = contar(
    'SELECT COUNT(*) as total FROM fila_humana WHERE cliente_id = ?',
    clienteId,
  );
  conexao.prepare('DELETE FROM fila_humana WHERE cliente_id = ?').run(clienteId);

  const consentimentosRevogados = contar(
    'SELECT COUNT(*) as total FROM consentimentos WHERE cliente_id = ? AND revogado_em IS NULL',
    clienteId,
  );
  conexao
    .prepare(
      'UPDATE consentimentos SET revogado_em = ? WHERE cliente_id = ? AND revogado_em IS NULL',
    )
    .run(agora(), clienteId);

  // Envios de campanha guardam apenas o vínculo com o cliente; o vínculo some.
  conexao.prepare('DELETE FROM envios_campanha WHERE cliente_id = ?').run(clienteId);

  // O cadastro é anonimizado, não apagado: assim nenhuma referência antiga
  // fica quebrada, mas não sobra dado pessoal.
  const jaAnonimizado = cliente.nome === NOME_ANONIMIZADO;
  conexao
    .prepare('UPDATE clientes SET nome = ?, email = ?, telefone = ? WHERE id = ?')
    .run(NOME_ANONIMIZADO, '', '', clienteId);

  conexao
    .prepare(
      "UPDATE pedidos_exclusao SET status = 'concluido', concluido_em = ? WHERE cliente_id = ? AND tipo = 'exclusao' AND status = 'aberto'",
    )
    .run(agora(), clienteId);

  const relatorio: RelatorioExclusao = {
    clienteId,
    conversasApagadas: conversasAlvo.length,
    mensagensApagadas,
    notasApagadas,
    itensDeFilaApagados,
    consentimentosRevogados,
    cadastroAnonimizado: !jaAnonimizado,
    executadoEm: agora(),
  };

  auditoria.registrar({
    ator: solicitante,
    acao: 'lgpd:exclusao_executada',
    recurso: clienteId,
    resultado: 'permitido',
    detalhe: `${relatorio.conversasApagadas} conversas, ${relatorio.mensagensApagadas} mensagens, cadastro anonimizado`,
  });
  metricas.registrar('lgpd_exclusao_executada', { detalhe: clienteId });
  log.info('exclusao de dados executada', { conversas: relatorio.conversasApagadas });

  return ok(relatorio);
}

/** Executa a interrupção de comunicações: revoga marketing e utilidade. */
export function executarInterrupcao(clienteId: string, solicitante = 'painel'): Resultado<true> {
  if (!clientes.porId(clienteId)) {
    return falha({
      codigo: 'nao_encontrado',
      mensagem: 'Cliente não encontrado.',
      origem: 'lgpd',
    });
  }
  consentimentos.revogar(clienteId, 'marketing');
  consentimentos.revogar(clienteId, 'utilidade');
  db()
    .prepare(
      "UPDATE pedidos_exclusao SET status = 'concluido', concluido_em = ? WHERE cliente_id = ? AND tipo = 'interrupcao' AND status = 'aberto'",
    )
    .run(agora(), clienteId);

  auditoria.registrar({
    ator: solicitante,
    acao: 'lgpd:interrupcao_executada',
    recurso: clienteId,
    resultado: 'permitido',
    detalhe: 'consentimentos de marketing e utilidade revogados',
  });
  return ok(true);
}

/** Abre um pedido do titular para acompanhamento no painel. */
export function abrirPedidoDoTitular(
  clienteId: string,
  tipo: 'exclusao' | 'interrupcao',
): Resultado<{ id: string }> {
  if (!clientes.porId(clienteId)) {
    return falha({
      codigo: 'nao_encontrado',
      mensagem: 'Cliente não encontrado.',
      origem: 'lgpd',
    });
  }
  const id = pedidosExclusao.registrar(clienteId, tipo);
  auditoria.registrar({
    ator: 'painel',
    acao: `lgpd:pedido_registrado:${tipo}`,
    recurso: clienteId,
    resultado: 'permitido',
    detalhe: 'pedido do titular registrado para tratamento',
  });
  return ok({ id });
}
