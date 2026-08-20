import { falha, ok, type Pedido, type Resultado } from '@fdc/shared';
import { config } from '../../config.js';
import { executarComProtecao } from '../resiliencia.js';
import type { CredenciaisConsultaPedido, OrderProvider } from './tipos.js';

/**
 * Adaptador de pedidos do Shopify - SOMENTE LEITURA.
 * A verificacao de identidade acontece AQUI, antes de devolver qualquer dado.
 */

const CONSULTA_PEDIDO = `
query BuscarPedido($termo: String!) {
  orders(first: 1, query: $termo) {
    edges {
      node {
        id
        name
        email
        phone
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        currentTotalPriceSet { shopMoney { amount } }
        lineItems(first: 50) {
          edges { node { sku title quantity vendor originalUnitPriceSet { shopMoney { amount } } } }
        }
        fulfillments(first: 5) {
          trackingInfo { number company }
          estimatedDeliveryAt
        }
      }
    }
  }
}`;

const soDigitos = (v: string) => v.replace(/\D/g, '');

export class ShopifyOrderProvider implements OrderProvider {
  readonly nome = 'ShopifyOrderProvider';

  get modo(): 'real_desabilitado' | 'real_habilitado' {
    const c = config();
    return c.SHOPIFY_STORE_DOMAIN && c.SHOPIFY_ADMIN_TOKEN
      ? 'real_habilitado'
      : 'real_desabilitado';
  }

  private desabilitado<T>(): Resultado<T> {
    return falha({
      codigo: 'desabilitado',
      mensagem:
        'Integracao de pedidos com o Shopify ainda nao configurada. Cadastre as credenciais no .env.',
      origem: 'pedidos:shopify',
    });
  }

  async buscarComVerificacao(cred: CredenciaisConsultaPedido): Promise<Resultado<Pedido>> {
    if (this.modo !== 'real_habilitado') return this.desabilitado<Pedido>();
    if (!cred.email && !cred.telefone) {
      return falha({
        codigo: 'nao_autorizado',
        mensagem: 'E necessario informar e-mail ou telefone do pedido para confirmar a identidade.',
        origem: 'pedidos:shopify',
      });
    }

    const c = config();
    const numero = cred.numeroPedido.trim().replace(/^#/, '');
    const resultado = await executarComProtecao<Pedido | null>('pedidos:shopify', async (sinal) => {
      const url = `https://${c.SHOPIFY_STORE_DOMAIN}/admin/api/${c.SHOPIFY_API_VERSION}/graphql.json`;
      const resposta = await fetch(url, {
        method: 'POST',
        signal: sinal,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': c.SHOPIFY_ADMIN_TOKEN as string,
        },
        body: JSON.stringify({ query: CONSULTA_PEDIDO, variables: { termo: `name:${numero}` } }),
      });
      if (!resposta.ok) throw new Error(`Shopify respondeu ${resposta.status}`);
      const corpo = (await resposta.json()) as {
        data?: { orders: { edges: Array<{ node: Record<string, never> }> } };
        errors?: unknown;
      };
      if (corpo.errors || !corpo.data) throw new Error('Shopify retornou erro na consulta.');
      const no = corpo.data.orders.edges[0]?.node as Record<string, unknown> | undefined;
      if (!no) return null;
      return converterPedido(no);
    });

    if (!resultado.ok) return resultado;
    const pedido = resultado.dados;
    if (!pedido) {
      return falha({
        codigo: 'nao_autorizado',
        mensagem: 'Nao foi possivel confirmar esse pedido com os dados informados.',
        origem: 'pedidos:shopify',
      });
    }

    const emailConfere =
      Boolean(cred.email) && pedido.emailCliente.toLowerCase() === cred.email!.trim().toLowerCase();
    const telefoneConfere =
      Boolean(cred.telefone) &&
      soDigitos(cred.telefone!).length >= 8 &&
      soDigitos(pedido.telefoneCliente).slice(-8) === soDigitos(cred.telefone!).slice(-8);

    if (!emailConfere && !telefoneConfere) {
      return falha({
        codigo: 'nao_autorizado',
        mensagem: 'Nao foi possivel confirmar esse pedido com os dados informados.',
        origem: 'pedidos:shopify',
      });
    }
    return ok(pedido);
  }

  async listarInterno(): Promise<Resultado<Pedido[]>> {
    return this.desabilitado<Pedido[]>();
  }

  async ultimoPedidoDoCliente(_clienteId: string): Promise<Resultado<Pedido>> {
    return this.desabilitado<Pedido>();
  }
}

const MAPA_PAGAMENTO: Record<string, Pedido['statusPagamento']> = {
  PAID: 'pago',
  PENDING: 'pendente',
  REFUNDED: 'estornado',
  VOIDED: 'cancelado',
};

const MAPA_PROCESSAMENTO: Record<string, Pedido['statusProcessamento']> = {
  UNFULFILLED: 'aguardando_faturamento',
  IN_PROGRESS: 'em_separacao',
  FULFILLED: 'despachado',
  DELIVERED: 'entregue',
};

function converterPedido(no: Record<string, unknown>): Pedido {
  const itens = (
    (no['lineItems'] as { edges: Array<{ node: Record<string, unknown> }> } | undefined)?.edges ??
    []
  ).map((e) => ({
    sku: String(e.node['sku'] ?? ''),
    titulo: String(e.node['title'] ?? ''),
    marca: String(e.node['vendor'] ?? '')
      .toLowerCase()
      .includes('nutrition')
      ? ('FDC Nutrition' as const)
      : ('FDC Vitaminas' as const),
    quantidade: Number(e.node['quantity'] ?? 0),
    precoUnitarioCentavos: Math.round(
      Number.parseFloat(
        String(
          (e.node['originalUnitPriceSet'] as { shopMoney?: { amount?: string } } | undefined)
            ?.shopMoney?.amount ?? '0',
        ),
      ) * 100,
    ),
  }));

  const fulfillment = (no['fulfillments'] as Array<Record<string, unknown>> | undefined)?.[0];
  const rastreio = (
    fulfillment?.['trackingInfo'] as Array<Record<string, unknown>> | undefined
  )?.[0];

  return {
    id: String(no['id'] ?? ''),
    numero: String(no['name'] ?? '').replace(/^#/, ''),
    emailCliente: String(no['email'] ?? ''),
    telefoneCliente: String(no['phone'] ?? ''),
    criadoEm: String(no['createdAt'] ?? ''),
    statusPagamento: MAPA_PAGAMENTO[String(no['displayFinancialStatus'] ?? '')] ?? 'pendente',
    statusProcessamento:
      MAPA_PROCESSAMENTO[String(no['displayFulfillmentStatus'] ?? '')] ?? 'aguardando_faturamento',
    itens,
    totalCentavos: Math.round(
      Number.parseFloat(
        String(
          (no['currentTotalPriceSet'] as { shopMoney?: { amount?: string } } | undefined)?.shopMoney
            ?.amount ?? '0',
        ),
      ) * 100,
    ),
    prazoPrometidoEm: (fulfillment?.['estimatedDeliveryAt'] as string | null) ?? null,
    codigoRastreio: (rastreio?.['number'] as string | null) ?? null,
    transportadora: (rastreio?.['company'] as string | null) ?? null,
    ficticio: false,
  };
}
