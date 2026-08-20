import { falha, type Resultado } from '@fdc/shared';
import { config } from '../../config.js';
import type { CarrinhoAbandonado, CartProvider } from './tipos.js';

/**
 * ADAPTADOR DE CARRINHOS ABANDONADOS DO SHOPIFY — CONTRATO APENAS.
 *
 * O Shopify expõe os carrinhos abandonados (abandoned checkouts) pela Admin API,
 * mas isso envolve dado pessoal de quem NÃO concluiu a compra. Antes de ligar,
 * é preciso confirmar:
 *   - a base legal para tratar esses dados;
 *   - se o cliente consentiu em ser contatado;
 *   - por quanto tempo esses carrinhos podem ser guardados.
 *
 * Enquanto isso não estiver resolvido com o jurídico, permanece DESABILITADO.
 * Ver docs/05-checklist-shopify.md.
 */
export class ShopifyCartProvider implements CartProvider {
  readonly nome = 'ShopifyCartProvider';

  get modo(): 'real_desabilitado' | 'real_habilitado' {
    void config();
    return 'real_desabilitado';
  }

  async maisRecenteDoCliente(_clienteId: string): Promise<Resultado<CarrinhoAbandonado>> {
    return this.desabilitado<CarrinhoAbandonado>();
  }

  async listarInterno(): Promise<Resultado<CarrinhoAbandonado[]>> {
    return this.desabilitado<CarrinhoAbandonado[]>();
  }

  private desabilitado<T>(): Resultado<T> {
    return falha({
      codigo: 'desabilitado',
      mensagem:
        'Carrinhos abandonados do Shopify ainda não habilitados. Depende de definição de base legal e consentimento.',
      origem: 'carrinho:shopify',
    });
  }
}
