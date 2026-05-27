import { Hono } from 'hono';
import { validateShopifyHmac } from '../utils/hmac.js';
import { logger } from '../utils/logger.js';
import {
  isWebhookProcessed,
  markWebhookProcessed,
  createSchedule,
} from '../services/scheduler.js';
import { getProductInfo, toProductGid, buildProductUrl } from '../services/shopify.js';
import type { ShopifyOrderWebhook } from '../types/index.js';

export const webhookRouter = new Hono();

webhookRouter.post('/orders/paid', async (c) => {
  // Read raw body for HMAC validation
  const rawBody = await c.req.arrayBuffer();
  const bodyBuffer = Buffer.from(rawBody);
  const signature = c.req.header('x-shopify-hmac-sha256') ?? '';
  const webhookId = c.req.header('x-shopify-webhook-id') ?? '';
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET ?? '';

  if (!validateShopifyHmac(bodyBuffer, signature, webhookSecret)) {
    logger.warn('Invalid HMAC signature', { webhookId });
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Idempotency check
  if (webhookId && (await isWebhookProcessed(webhookId))) {
    logger.info('Duplicate webhook ignored', { webhookId });
    return c.json({ ok: true, duplicate: true });
  }

  let order: ShopifyOrderWebhook;
  try {
    order = JSON.parse(bodyBuffer.toString('utf8')) as ShopifyOrderWebhook;
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  const customer = order.customer;
  if (!customer) {
    logger.warn('Order has no customer', { orderId: order.id });
    if (webhookId) await markWebhookProcessed(webhookId);
    return c.json({ ok: true, skipped: 'no_customer' });
  }

  const orderPaidAt = order.processed_at
    ? new Date(order.processed_at)
    : new Date(order.created_at);

  const results = await Promise.allSettled(
    order.line_items.map(async (item) => {
      const productGid = toProductGid(item.product_id);
      const product = await getProductInfo(productGid);

      if (!product?.metafields?.enabled) {
        logger.debug('Product replenishment disabled, skipping', { sku: item.sku });
        return null;
      }

      const schedule = await createSchedule({
        orderId: String(order.id),
        orderName: order.name,
        customerId: String(customer.id),
        customerEmail: customer.email,
        customerFirstName: customer.first_name || null,
        acceptsMarketing: customer.accepts_marketing,
        productId: String(item.product_id),
        variantId: String(item.variant_id),
        sku: item.sku ?? '',
        productTitle: item.title,
        productUrl: buildProductUrl(product.handle),
        imageUrl: product.featuredImage?.url ?? null,
        metafields: product.metafields,
        orderPaidAt,
      });

      return schedule;
    })
  );

  const scheduled = results.filter(
    (r) => r.status === 'fulfilled' && r.value !== null
  ).length;

  logger.info('Webhook processed', {
    orderId: order.id,
    lineItems: order.line_items.length,
    scheduled,
  });

  if (webhookId) await markWebhookProcessed(webhookId);
  return c.json({ ok: true, scheduled });
});
