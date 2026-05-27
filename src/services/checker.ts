import {
  getProductInfo,
  hasCustomerReordered,
  buildProductUrl,
  toProductGid,
  toVariantGid,
  toCustomerGid,
} from './shopify.js';
import type { ReplenishmentSchedule, ProductInfo } from '../types/index.js';

export type CheckResult =
  | { ok: true; product: ProductInfo }
  | { ok: false; reason: ReplenishmentSchedule['status'] };

export async function preflightCheck(
  schedule: ReplenishmentSchedule
): Promise<CheckResult> {
  if (!schedule.customer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(schedule.customer_email)) {
    return { ok: false, reason: 'skipped_no_email' };
  }

  if (!schedule.accepts_marketing) {
    return { ok: false, reason: 'skipped_no_consent' };
  }

  const product = await getProductInfo(toProductGid(schedule.product_id));
  if (!product) {
    return { ok: false, reason: 'skipped_inactive_product' };
  }

  if (product.status !== 'ACTIVE') {
    return { ok: false, reason: 'skipped_inactive_product' };
  }

  if (product.totalInventory <= 0) {
    return { ok: false, reason: 'skipped_out_of_stock' };
  }

  const reordered = await hasCustomerReordered(
    toCustomerGid(schedule.customer_id),
    toVariantGid(schedule.variant_id),
    schedule.created_at
  );
  if (reordered) {
    return { ok: false, reason: 'skipped_reordered' };
  }

  return { ok: true, product };
}

export function resolveProductUrl(product: ProductInfo): string {
  return buildProductUrl(product.handle);
}
