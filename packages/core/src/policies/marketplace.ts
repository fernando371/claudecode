import { contemAlgum } from '@fdc/shared';

/**
 * PROTEÇÃO DE MARKETPLACE.
 *
 * A loja da FDC no Shopify recebe também os pedidos vindos de marketplaces
 * (Shopee, Mercado Livre e outros). Eles chegam como itens **sem SKU**, com o
 * título marcado como não vinculado ao catálogo, e às vezes com linhas de ajuste
 * do próprio marketplace.
 *
 * Isso importa por duas razões:
 *
 * 1. **Regra de canal.** Não podemos criar fluxo que puxe comprador de
 *    marketplace para comprar fora da plataforma. Então, em pedido de
 *    marketplace, o agente não oferece recompra nem link de carrinho do site.
 *
 * 2. **Dado incompleto.** Sem SKU, não dá para saber qual produto foi comprado.
 *    O agente admite isso em vez de tentar adivinhar.
 */

const MARCAS_DE_MARKETPLACE = [
  'not linked to shopify',
  'shopee',
  'mercado livre',
  'mercadolivre',
  'mercado libre',
  'amazon',
  'magalu',
  'americanas',
  'order adjustment',
];

export interface ItemDePedido {
  sku?: string | null;
  titulo?: string | null;
}

/** true quando o pedido aparenta ter vindo de um marketplace. */
export function pedidoDeMarketplace(itens: readonly ItemDePedido[]): boolean {
  if (itens.length === 0) return false;
  return itens.some((item) => {
    const semSku = !item.sku || item.sku.trim() === '';
    const titulo = item.titulo ?? '';
    return semSku && contemAlgum(titulo, MARCAS_DE_MARKETPLACE);
  });
}

export const RECOMPRA_EM_MARKETPLACE =
  'Sua última compra veio de um marketplace, e por lá eu não consigo acompanhar o pedido nem repetir a compra por aqui. O melhor caminho é falar pelo canal de mensagens do próprio marketplace. Se preferir, posso te ajudar a encontrar o produto aqui no atendimento da FDC.';
