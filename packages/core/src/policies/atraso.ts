import type { Pedido, Rastreamento, StatusRastreio } from '@fdc/shared';

/**
 * Regras para identificar POSSIVEL atraso.
 *
 * O sistema nunca "chuta": ele compara datas concretas. Quando falta
 * informacao, marca como indefinido e manda para o atendente humano.
 */

export interface AvaliacaoAtraso {
  possivelAtraso: boolean;
  indefinido: boolean;
  motivos: string[];
  diasAlemDoPrazo: number | null;
  diasSemMovimentacao: number | null;
}

/** Horario de corte de expedicao (hora local). Configuravel por operacao. */
export const HORARIO_DE_CORTE = 14;

/** Depois de quantos dias sem nova movimentacao consideramos suspeito. */
export const DIAS_SEM_MOVIMENTACAO_SUSPEITO = 5;

const DIA_MS = 24 * 3600 * 1000;

function diasEntre(inicio: string | null, fim: number): number | null {
  if (!inicio) return null;
  const t = Date.parse(inicio);
  if (Number.isNaN(t)) return null;
  return Math.floor((fim - t) / DIA_MS);
}

export function avaliarAtraso(
  pedido: Pedido,
  rastreio: Rastreamento | null,
  agoraMs: number = Date.now(),
): AvaliacaoAtraso {
  const motivos: string[] = [];
  const diasAlemDoPrazo = diasEntre(pedido.prazoPrometidoEm, agoraMs);
  const diasSemMovimentacao = diasEntre(rastreio?.ultimaMovimentacaoEm ?? null, agoraMs);

  const statusFinal: StatusRastreio | null = rastreio?.status ?? null;

  if (statusFinal === 'entregue' || pedido.statusProcessamento === 'entregue') {
    return {
      possivelAtraso: false,
      indefinido: false,
      motivos: ['atraso:pedido_entregue'],
      diasAlemDoPrazo,
      diasSemMovimentacao,
    };
  }

  if (statusFinal === 'extraviado') motivos.push('atraso:transportadora_informou_extravio');
  if (statusFinal === 'atrasado') motivos.push('atraso:transportadora_informou_atraso');
  if (statusFinal === 'devolvido') motivos.push('atraso:objeto_devolvido');

  if (diasAlemDoPrazo !== null && diasAlemDoPrazo > 0) {
    motivos.push(`atraso:prazo_prometido_vencido_ha_${diasAlemDoPrazo}_dias`);
  }
  if (diasSemMovimentacao !== null && diasSemMovimentacao >= DIAS_SEM_MOVIMENTACAO_SUSPEITO) {
    motivos.push(`atraso:sem_movimentacao_ha_${diasSemMovimentacao}_dias`);
  }
  if (
    pedido.statusPagamento === 'pago' &&
    pedido.statusProcessamento === 'aguardando_faturamento' &&
    (diasEntre(pedido.criadoEm, agoraMs) ?? 0) >= 2
  ) {
    motivos.push('atraso:pago_mas_nao_faturado');
  }

  const indefinido =
    statusFinal === 'desconhecido' || (rastreio === null && Boolean(pedido.codigoRastreio));
  if (indefinido) motivos.push('atraso:status_indefinido');

  return {
    possivelAtraso: motivos.length > 0 && !indefinido,
    indefinido,
    motivos: motivos.length ? motivos : ['atraso:dentro_do_prazo'],
    diasAlemDoPrazo,
    diasSemMovimentacao,
  };
}
