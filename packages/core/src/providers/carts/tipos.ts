import type { Resultado } from '@fdc/shared';

export interface ItemCarrinho {
  sku: string;
  quantidade: number;
}

export interface CarrinhoAbandonado {
  id: string;
  clienteId: string;
  criadoEm: string;
  itens: ItemCarrinho[];
  ficticio: boolean;
}

export interface CartProvider {
  readonly nome: string;
  readonly modo: 'mock' | 'real_desabilitado' | 'real_habilitado';
  /** Carrinho abandonado mais recente do cliente, se houver. */
  maisRecenteDoCliente(clienteId: string): Promise<Resultado<CarrinhoAbandonado>>;
  /** Uso interno do painel. */
  listarInterno(): Promise<Resultado<CarrinhoAbandonado[]>>;
}
