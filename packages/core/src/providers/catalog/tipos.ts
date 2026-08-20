import type { Produto, Resultado } from '@fdc/shared';

export interface CatalogProvider {
  readonly nome: string;
  readonly modo: 'mock' | 'real_desabilitado' | 'real_habilitado';
  buscar(termo: string, limite?: number): Promise<Resultado<Produto[]>>;
  porId(id: string): Promise<Resultado<Produto>>;
  porSku(sku: string): Promise<Resultado<Produto>>;
  listar(): Promise<Resultado<Produto[]>>;
  /** Gera link de carrinho a partir de SKUs. Nao cria pedido nem altera nada. */
  linkCarrinho(skus: Array<{ sku: string; quantidade: number }>): Promise<Resultado<string>>;
}
