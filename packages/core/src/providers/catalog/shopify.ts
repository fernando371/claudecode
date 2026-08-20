import { falha, ok, type Produto, type Resultado } from '@fdc/shared';
import { config } from '../../config.js';
import { executarComProtecao } from '../resiliencia.js';
import type { CatalogProvider } from './tipos.js';

/**
 * Adaptador Shopify - SOMENTE LEITURA.
 * Nunca altera produto, preco, estoque ou conteudo da loja.
 * Fica desabilitado enquanto nao houver credenciais no .env.
 */

const CONSULTA_PRODUTOS = `
query BuscarProdutos($termo: String!, $limite: Int!) {
  products(first: $limite, query: $termo) {
    edges {
      node {
        id
        title
        handle
        description
        productType
        vendor
        onlineStoreUrl
        featuredImage { url }
        variants(first: 20) {
          edges {
            node {
              sku
              title
              price
              availableForSale
              inventoryQuantity
            }
          }
        }
        metafields(identifiers: [
          {namespace: "fdc", key: "composicao"},
          {namespace: "fdc", key: "modo_de_uso"},
          {namespace: "fdc", key: "advertencias"},
          {namespace: "fdc", key: "porcao_por_embalagem"}
        ]) { key value }
      }
    }
  }
}`;

interface NoVariante {
  sku: string | null;
  title: string;
  price: string;
  availableForSale: boolean;
  inventoryQuantity: number | null;
}

interface NoProduto {
  id: string;
  title: string;
  handle: string;
  description: string;
  productType: string | null;
  vendor: string | null;
  onlineStoreUrl: string | null;
  featuredImage: { url: string } | null;
  variants: { edges: Array<{ node: NoVariante }> };
  metafields: Array<{ key: string; value: string } | null>;
}

export class ShopifyCatalogProvider implements CatalogProvider {
  readonly nome = 'ShopifyCatalogProvider';

  get modo(): 'real_desabilitado' | 'real_habilitado' {
    return this.configurado() ? 'real_habilitado' : 'real_desabilitado';
  }

  private configurado(): boolean {
    const c = config();
    return Boolean(c.SHOPIFY_STORE_DOMAIN && c.SHOPIFY_ADMIN_TOKEN);
  }

  private desabilitado<T>(): Resultado<T> {
    return falha({
      codigo: 'desabilitado',
      mensagem:
        'Integracao com o Shopify ainda nao configurada. Cadastre SHOPIFY_STORE_DOMAIN e SHOPIFY_ADMIN_TOKEN no .env.',
      origem: 'catalogo:shopify',
    });
  }

  private async consultar<T>(
    consulta: string,
    variaveis: Record<string, unknown>,
  ): Promise<Resultado<T>> {
    if (!this.configurado()) return this.desabilitado<T>();
    const c = config();
    return executarComProtecao<T>('catalogo:shopify', async (sinal) => {
      const url = `https://${c.SHOPIFY_STORE_DOMAIN}/admin/api/${c.SHOPIFY_API_VERSION}/graphql.json`;
      const resposta = await fetch(url, {
        method: 'POST',
        signal: sinal,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': c.SHOPIFY_ADMIN_TOKEN as string,
        },
        body: JSON.stringify({ query: consulta, variables: variaveis }),
      });
      if (!resposta.ok) throw new Error(`Shopify respondeu ${resposta.status}`);
      const corpo = (await resposta.json()) as { data?: T; errors?: unknown };
      if (corpo.errors) throw new Error('Shopify retornou erros na consulta GraphQL.');
      if (!corpo.data) throw new Error('Shopify nao retornou dados.');
      return corpo.data;
    });
  }

  private converter(no: NoProduto): Produto {
    const meta = new Map(
      (no.metafields ?? []).filter(Boolean).map((m) => [m!.key, m!.value] as const),
    );
    const marca = (no.vendor ?? '').toLowerCase().includes('nutrition')
      ? 'FDC Nutrition'
      : 'FDC Vitaminas';
    return {
      id: no.id,
      marca,
      titulo: no.title,
      descricaoCurta: (no.description ?? '').slice(0, 280),
      categoria: no.productType ?? 'nao_classificado',
      url: no.onlineStoreUrl ?? '',
      imagemUrl: no.featuredImage?.url ?? null,
      variantes: no.variants.edges.map((e) => ({
        sku: e.node.sku ?? '',
        titulo: e.node.title,
        precoCentavos: Math.round(Number.parseFloat(e.node.price) * 100),
        moeda: 'BRL' as const,
        disponivel: e.node.availableForSale,
        estoque: e.node.inventoryQuantity,
      })),
      rotulo: {
        composicao: meta.get('composicao') ?? null,
        modoDeUso: meta.get('modo_de_uso') ?? null,
        advertencias: meta.get('advertencias') ?? null,
        porcaoPorEmbalagem: meta.get('porcao_por_embalagem') ?? null,
      },
      ficticio: false,
    };
  }

  async buscar(termo: string, limite = 5): Promise<Resultado<Produto[]>> {
    const r = await this.consultar<{ products: { edges: Array<{ node: NoProduto }> } }>(
      CONSULTA_PRODUTOS,
      { termo, limite },
    );
    if (!r.ok) return r;
    return ok(r.dados.products.edges.map((e) => this.converter(e.node)));
  }

  async listar(): Promise<Resultado<Produto[]>> {
    return this.buscar('', 50);
  }

  async porId(id: string): Promise<Resultado<Produto>> {
    const r = await this.buscar(`id:${id}`, 1);
    if (!r.ok) return r;
    const p = r.dados[0];
    if (!p)
      return falha({
        codigo: 'nao_encontrado',
        mensagem: 'Produto nao encontrado.',
        origem: 'catalogo:shopify',
      });
    return ok(p);
  }

  async porSku(sku: string): Promise<Resultado<Produto>> {
    const r = await this.buscar(`sku:${sku}`, 1);
    if (!r.ok) return r;
    const p = r.dados[0];
    if (!p)
      return falha({
        codigo: 'nao_encontrado',
        mensagem: 'SKU nao encontrado.',
        origem: 'catalogo:shopify',
      });
    return ok(p);
  }

  async linkCarrinho(skus: Array<{ sku: string; quantidade: number }>): Promise<Resultado<string>> {
    const c = config();
    if (!c.SHOPIFY_STOREFRONT_BASE_URL) return this.desabilitado<string>();
    if (skus.length === 0)
      return falha({
        codigo: 'entrada_invalida',
        mensagem: 'Informe ao menos um SKU.',
        origem: 'catalogo:shopify',
      });
    // Observacao: o link de carrinho do Shopify usa IDs de variante, nao SKU.
    // A conversao SKU -> variantId sera feita quando as credenciais existirem.
    return falha({
      codigo: 'desabilitado',
      mensagem: 'Conversao de SKU para ID de variante do Shopify ainda nao habilitada.',
      origem: 'catalogo:shopify',
    });
  }
}
