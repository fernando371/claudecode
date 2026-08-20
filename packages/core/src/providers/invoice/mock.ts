import { falha, ok, type NotaFiscal, type Resultado } from '@fdc/shared';
import { diasParaIso, notaFiscalBruta } from '../orders/mock.js';
import { simulacao } from '../simulacaoFalhas.js';
import type { InvoiceProvider } from './tipos.js';

export class MockInvoiceProvider implements InvoiceProvider {
  readonly nome = 'MockInvoiceProvider';
  readonly modo = 'mock' as const;

  async porPedido(numeroPedido: string): Promise<Resultado<NotaFiscal>> {
    if (simulacao.ler().notaFiscalIndisponivel) {
      return falha({
        codigo: 'indisponivel',
        mensagem: 'Sistema de faturamento simulado marcado como indisponivel pelo simulador.',
        origem: 'nota_fiscal:mock',
      });
    }
    const bruta = notaFiscalBruta(numeroPedido.trim().toUpperCase().replace(/^#/, ''));
    if (!bruta) {
      return falha({
        codigo: 'nao_encontrado',
        mensagem: 'Pedido sem informacao de faturamento no ambiente simulado.',
        origem: 'nota_fiscal:mock',
      });
    }
    return ok({
      pedidoNumero: numeroPedido,
      emitida: bruta.emitida,
      numero: bruta.numero,
      serie: bruta.serie,
      chaveAcesso: bruta.emitida ? '[EXEMPLO] 00000000000000000000000000000000000000000000' : null,
      emitidaEm: bruta.emitidaEmDias === null ? null : diasParaIso(bruta.emitidaEmDias),
      danfeUrl: bruta.emitida ? 'https://exemplo.invalido/danfe/demo.pdf' : null,
      ficticio: true,
    } satisfies NotaFiscal);
  }
}
