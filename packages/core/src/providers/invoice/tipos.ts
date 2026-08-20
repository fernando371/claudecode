import type { NotaFiscal, Resultado } from '@fdc/shared';

export interface InvoiceProvider {
  readonly nome: string;
  readonly modo: 'mock' | 'real_desabilitado' | 'real_habilitado';
  /** Consulta a Nota Fiscal de um pedido ja verificado. */
  porPedido(numeroPedido: string): Promise<Resultado<NotaFiscal>>;
}
