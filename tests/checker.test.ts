import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReplenishmentSchedule, ProductInfo } from '../src/types/index.js';

vi.mock('../src/services/shopify.js', () => ({
  getProductInfo: vi.fn(),
  hasCustomerReordered: vi.fn(),
  buildProductUrl: vi.fn().mockReturnValue('https://example.com/products/whey'),
  toProductGid: (id: string) => `gid://shopify/Product/${id}`,
  toVariantGid: (id: string) => `gid://shopify/ProductVariant/${id}`,
  toCustomerGid: (id: string) => `gid://shopify/Customer/${id}`,
}));

const baseSchedule: ReplenishmentSchedule = {
  id: 'sched-1',
  order_id: 'order-1',
  order_name: '#1001',
  customer_id: '42',
  customer_email: 'test@example.com',
  customer_first_name: 'João',
  accepts_marketing: true,
  product_id: '100',
  variant_id: '200',
  sku: 'FDC-001',
  product_title: 'Whey Protein',
  product_url: null,
  image_url: null,
  consumption_days: 30,
  trigger_date: new Date(),
  status: 'processing',
  status_reason: null,
  sent_at: null,
  created_at: new Date('2025-01-01T00:00:00Z'),
  updated_at: new Date(),
};

const activeProduct: ProductInfo = {
  id: 'gid://shopify/Product/100',
  title: 'Whey Protein',
  status: 'ACTIVE',
  handle: 'whey-protein',
  featuredImage: { url: 'https://cdn.shopify.com/img.jpg' },
  totalInventory: 50,
  metafields: { enabled: true, consumption_days: 30, reminder_delay_days: 25, source: null },
};

describe('preflightCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes all checks for a valid schedule', async () => {
    const { getProductInfo, hasCustomerReordered } = await import('../src/services/shopify.js');
    vi.mocked(getProductInfo).mockResolvedValue(activeProduct);
    vi.mocked(hasCustomerReordered).mockResolvedValue(false);

    const { preflightCheck } = await import('../src/services/checker.js');
    const result = await preflightCheck(baseSchedule);
    expect(result.ok).toBe(true);
  });

  it('skips when customer has no valid email', async () => {
    const { preflightCheck } = await import('../src/services/checker.js');
    const result = await preflightCheck({ ...baseSchedule, customer_email: 'invalid-email' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('skipped_no_email');
  });

  it('skips when customer did not accept marketing', async () => {
    const { preflightCheck } = await import('../src/services/checker.js');
    const result = await preflightCheck({ ...baseSchedule, accepts_marketing: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('skipped_no_consent');
  });

  it('skips when product is out of stock', async () => {
    const { getProductInfo, hasCustomerReordered } = await import('../src/services/shopify.js');
    vi.mocked(getProductInfo).mockResolvedValue({ ...activeProduct, totalInventory: 0 });
    vi.mocked(hasCustomerReordered).mockResolvedValue(false);

    const { preflightCheck } = await import('../src/services/checker.js');
    const result = await preflightCheck(baseSchedule);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('skipped_out_of_stock');
  });

  it('skips when product is inactive', async () => {
    const { getProductInfo } = await import('../src/services/shopify.js');
    vi.mocked(getProductInfo).mockResolvedValue({ ...activeProduct, status: 'DRAFT' });

    const { preflightCheck } = await import('../src/services/checker.js');
    const result = await preflightCheck(baseSchedule);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('skipped_inactive_product');
  });

  it('skips when product no longer exists', async () => {
    const { getProductInfo } = await import('../src/services/shopify.js');
    vi.mocked(getProductInfo).mockResolvedValue(null);

    const { preflightCheck } = await import('../src/services/checker.js');
    const result = await preflightCheck(baseSchedule);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('skipped_inactive_product');
  });

  it('skips when customer already reordered the SKU', async () => {
    const { getProductInfo, hasCustomerReordered } = await import('../src/services/shopify.js');
    vi.mocked(getProductInfo).mockResolvedValue(activeProduct);
    vi.mocked(hasCustomerReordered).mockResolvedValue(true);

    const { preflightCheck } = await import('../src/services/checker.js');
    const result = await preflightCheck(baseSchedule);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('skipped_reordered');
  });

  it('checks reorder after the original order date, not now', async () => {
    const { getProductInfo, hasCustomerReordered } = await import('../src/services/shopify.js');
    vi.mocked(getProductInfo).mockResolvedValue(activeProduct);
    vi.mocked(hasCustomerReordered).mockResolvedValue(false);

    const { preflightCheck } = await import('../src/services/checker.js');
    await preflightCheck(baseSchedule);

    const toVariantGid = (id: string) => `gid://shopify/ProductVariant/${id}`;
    const toCustomerGid = (id: string) => `gid://shopify/Customer/${id}`;

    expect(vi.mocked(hasCustomerReordered)).toHaveBeenCalledWith(
      toCustomerGid('42'),
      toVariantGid('200'),
      baseSchedule.created_at
    );
  });
});
