import { falha, ok, type Rastreamento, type Resultado, type StatusRastreio } from '@fdc/shared';
import { carregarPedidosBrutos, diasParaIso } from '../orders/mock.js';
import { simulacao } from '../simulacaoFalhas.js';
import type { TrackingProvider } from './tipos.js';

const CENARIOS: Record<string, StatusRastreio> = {
  normal: 'em_transito',
  atrasado: 'atrasado',
  extraviado: 'extraviado',
  entregue: 'entregue',
  sem_nota: 'aguardando_coleta',
};

export class MockTrackingProvider implements TrackingProvider {
  readonly nome = 'MockTrackingProvider';
  readonly transportadora = 'Transportadora simulada';
  readonly modo = 'mock' as const;

  async rastrear(codigo: string): Promise<Resultado<Rastreamento>> {
    const s = simulacao.ler();
    const pedido = carregarPedidosBrutos().find((p) => p.codigoRastreio === codigo);
    if (!pedido) {
      return falha({
        codigo: 'nao_encontrado',
        mensagem: 'Codigo de rastreio nao encontrado no ambiente simulado.',
        origem: 'rastreio:mock',
      });
    }

    let status: StatusRastreio = CENARIOS[pedido.cenario] ?? 'desconhecido';
    if (s.rastreioDesconhecido) status = 'desconhecido';
    if (s.rastreioAtrasado) status = 'atrasado';
    if (s.rastreioExtraviado) status = 'extraviado';

    const coletadoEm =
      pedido.statusProcessamento === 'aguardando_faturamento'
        ? null
        : diasParaIso(pedido.criadoEmDias + 1);
    const ultimaMov =
      status === 'desconhecido' ? null : diasParaIso(Math.min(pedido.criadoEmDias + 3, -1));

    return ok({
      codigo,
      transportadora: pedido.transportadora ?? 'Transportadora simulada',
      status,
      ultimaMovimentacaoEm: ultimaMov,
      previsaoEntregaEm:
        pedido.prazoPrometidoEmDias === null ? null : diasParaIso(pedido.prazoPrometidoEmDias),
      coletadoEm,
      eventos:
        status === 'desconhecido'
          ? []
          : [
              {
                data: diasParaIso(pedido.criadoEmDias + 1),
                descricao: '[EXEMPLO] Objeto coletado',
                local: 'São Paulo/SP',
              },
              {
                data: ultimaMov ?? diasParaIso(-1),
                descricao: '[EXEMPLO] Objeto em trânsito',
                local: 'Centro de distribuição',
              },
            ],
      ficticio: true,
    } satisfies Rastreamento);
  }
}
