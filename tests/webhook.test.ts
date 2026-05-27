import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock DB and Shopify before importing the router
vi.mock('../src/db/client.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  pool: { query: vi.fn(), on: vi.fn() },
}));

vi.mock('../src/services/shopify.js', () => ({
  getProductInfo: vi.fn().mockResolvedValue(null),
  buildProductUrl: vi.fn().mockReturnValue('https://example.com/products/test'),
  toProductGid: (id: string) => `gid://shopify/Product/${id}`,
  toVariantGid: (id: string) => `gid://shopify/ProductVariant/${id}`,
  toCustomerGid: (id: string) => `gid://shopify/Customer/${id}`,
}));

vi.mock('../src/services/scheduler.js', () => ({
  isWebhookProcessed: vi.fn().mockResolvedValue(false),
  markWebhookProcessed: vi.fn().mockResolvedValue(undefined),
  createSchedule: vi.fn().mockResolvedValue({ id: 'uuid-1' }),
  calcTriggerDate: vi.fn(),
  getDueSchedules: vi.fn(),
  updateScheduleStatus: vi.fn(),
  appendLog: vi.fn(),
  listSchedules: vi.fn(),
  getScheduleLogs: vi.fn(),
}));

const SECRET = 'test-secret';

function makeSignature(body: string): string {
  return crypto.createHmac('sha256', SECRET).update(body).digest('base64');
}

async function postWebhook(body: string, headers: Record<string, string> = {}) {
  process.env.SHOPIFY_WEBHOOK_SECRET = SECRET;

  const { webhookRouter } = await import('../src/routes/webhook.js');

  const sig = headers['x-shopify-hmac-sha256'] ?? makeSignature(body);
  const req = new Request('http://localhost/orders/paid', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-shopify-hmac-sha256': sig,
      'x-shopify-webhook-id': headers['x-shopify-webhook-id'] ?? 'webhook-001',
      ...headers,
    },
  });

  return webhookRouter.fetch(req);
}

const validOrderPayload = JSON.stringify({
  id: 1001,
  name: '#1001',
  created_at: '2025-01-01T00:00:00Z',
  processed_at: '2025-01-01T00:01:00Z',
  customer: {
    id: 42,
    email: 'test@example.com',
    first_name: 'João',
    last_name: 'Silva',
    accepts_marketing: true,
  },
  line_items: [
    { id: 1, product_id: 100, variant_id: 200, sku: 'FDC-001', title: 'Whey Protein', quantity: 1 },
  ],
});

describe('Webhook /orders/paid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for invalid HMAC', async () => {
    const res = await postWebhook(validOrderPayload, {
      'x-shopify-hmac-sha256': 'invalidsignature==',
    });
    expect(res.status).toBe(401);
  });

  it('accepts a valid webhook and returns 200', async () => {
    const res = await postWebhook(validOrderPayload);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('returns duplicate: true for repeated webhook ID', async () => {
    const { isWebhookProcessed } = await import('../src/services/scheduler.js');
    vi.mocked(isWebhookProcessed).mockResolvedValueOnce(true);

    const res = await postWebhook(validOrderPayload, { 'x-shopify-webhook-id': 'dup-001' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
  });

  it('skips scheduling when product has replenishment disabled', async () => {
    const { getProductInfo } = await import('../src/services/shopify.js');
    vi.mocked(getProductInfo).mockResolvedValueOnce({
      id: 'gid://shopify/Product/100',
      title: 'Whey',
      status: 'ACTIVE',
      handle: 'whey',
      featuredImage: null,
      totalInventory: 10,
      metafields: { enabled: false, consumption_days: 30, reminder_delay_days: 25, source: null },
    });

    const { createSchedule } = await import('../src/services/scheduler.js');
    const res = await postWebhook(validOrderPayload);
    expect(res.status).toBe(200);
    expect(vi.mocked(createSchedule)).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const body = 'not-json';
    const res = await postWebhook(body);
    expect(res.status).toBe(400);
  });
});
