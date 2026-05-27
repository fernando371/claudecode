import type { ProductInfo, ProductMetafields } from '../types/index.js';

const SHOPIFY_API_VERSION = '2024-10';

function shopifyUrl(path: string): string {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  if (!domain) throw new Error('SHOPIFY_SHOP_DOMAIN is required');
  return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}${path}`;
}

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) throw new Error('SHOPIFY_ACCESS_TOKEN is required');

  const res = await fetch(shopifyUrl('/graphql.json'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Shopify GraphQL HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`);
  }
  return json.data;
}

// Parse raw metafield nodes into a typed struct
function parseMetafields(
  nodes: { namespace: string; key: string; value: string; type: string }[]
): ProductMetafields | null {
  const ns = 'fdc_replenishment';
  const fields = Object.fromEntries(
    nodes
      .filter((n) => n.namespace === ns)
      .map((n) => [n.key, n.value])
  );

  if (!('enabled' in fields)) return null;

  return {
    enabled: fields['enabled'] === 'true',
    consumption_days: parseInt(fields['consumption_days'] ?? '0', 10),
    reminder_delay_days: parseInt(fields['reminder_delay_days'] ?? '0', 10),
    source: fields['source'] ?? null,
  };
}

export async function getProductInfo(productGid: string): Promise<ProductInfo | null> {
  const data = await graphql<{
    product: {
      id: string;
      title: string;
      status: string;
      handle: string;
      totalInventory: number;
      featuredImage: { url: string } | null;
      metafields: { nodes: { namespace: string; key: string; value: string; type: string }[] };
    } | null;
  }>(
    `query GetProduct($id: ID!) {
      product(id: $id) {
        id
        title
        status
        handle
        totalInventory
        featuredImage { url }
        metafields(
          namespace: "fdc_replenishment"
          first: 10
        ) {
          nodes { namespace key value type }
        }
      }
    }`,
    { id: productGid }
  );

  if (!data.product) return null;

  const { metafields, ...rest } = data.product;
  return {
    ...rest,
    metafields: parseMetafields(metafields.nodes),
  };
}

// Returns the most recent order containing variantId placed AFTER afterDate
export async function hasCustomerReordered(
  customerGid: string,
  variantGid: string,
  afterDate: Date
): Promise<boolean> {
  const data = await graphql<{
    customer: {
      orders: {
        nodes: {
          id: string;
          createdAt: string;
          lineItems: { nodes: { variant: { id: string } | null }[] };
        }[];
      };
    } | null;
  }>(
    `query CheckReorder($customerId: ID!, $query: String!) {
      customer(id: $customerId) {
        orders(first: 50, query: $query, sortKey: CREATED_AT, reverse: true) {
          nodes {
            id
            createdAt
            lineItems(first: 50) {
              nodes { variant { id } }
            }
          }
        }
      }
    }`,
    {
      customerId: customerGid,
      // Filter server-side to orders after the original purchase
      query: `created_at:>${afterDate.toISOString()}`,
    }
  );

  const orders = data.customer?.orders.nodes ?? [];
  return orders.some((order) =>
    order.lineItems.nodes.some((li) => li.variant?.id === variantGid)
  );
}

export function buildProductUrl(handle: string): string {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN ?? '';
  // Remove .myshopify.com suffix if present to build storefront URL
  const storefront = domain.replace('.myshopify.com', '');
  return `https://${storefront}.com/products/${handle}`;
}

export function toProductGid(numericId: number | string): string {
  return `gid://shopify/Product/${numericId}`;
}

export function toVariantGid(numericId: number | string): string {
  return `gid://shopify/ProductVariant/${numericId}`;
}

export function toCustomerGid(numericId: number | string): string {
  return `gid://shopify/Customer/${numericId}`;
}
