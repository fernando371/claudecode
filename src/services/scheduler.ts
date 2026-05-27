import { query } from '../db/client.js';
import { logger } from '../utils/logger.js';
import type {
  ReplenishmentSchedule,
  ScheduleStatus,
  ShopifyOrderWebhook,
  ProductMetafields,
} from '../types/index.js';

export function calcTriggerDate(orderPaidAt: Date, reminderDelayDays: number): Date {
  const d = new Date(orderPaidAt);
  d.setDate(d.getDate() + reminderDelayDays);
  return d;
}

interface ScheduleInput {
  orderId: string;
  orderName: string;
  customerId: string;
  customerEmail: string;
  customerFirstName: string | null;
  acceptsMarketing: boolean;
  productId: string;
  variantId: string;
  sku: string;
  productTitle: string;
  productUrl: string | null;
  imageUrl: string | null;
  metafields: ProductMetafields;
  orderPaidAt: Date;
}

export async function createSchedule(input: ScheduleInput): Promise<ReplenishmentSchedule | null> {
  const triggerDate = calcTriggerDate(input.orderPaidAt, input.metafields.reminder_delay_days);

  const result = await query<ReplenishmentSchedule>(
    `INSERT INTO replenishment_schedules
      (order_id, order_name, customer_id, customer_email, customer_first_name,
       accepts_marketing, product_id, variant_id, sku, product_title,
       product_url, image_url, consumption_days, trigger_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'scheduled')
     ON CONFLICT (order_id, variant_id) DO NOTHING
     RETURNING *`,
    [
      input.orderId,
      input.orderName,
      input.customerId,
      input.customerEmail,
      input.customerFirstName,
      input.acceptsMarketing,
      input.productId,
      input.variantId,
      input.sku,
      input.productTitle,
      input.productUrl,
      input.imageUrl,
      input.metafields.consumption_days,
      triggerDate.toISOString(),
    ]
  );

  const schedule = result.rows[0] ?? null;
  if (schedule) {
    await appendLog(schedule.id, 'scheduled', {
      trigger_date: triggerDate.toISOString(),
      delay_days: input.metafields.reminder_delay_days,
    });
  }
  return schedule;
}

export async function getDueSchedules(limit = 100): Promise<ReplenishmentSchedule[]> {
  const result = await query<ReplenishmentSchedule>(
    `UPDATE replenishment_schedules
     SET status = 'processing'
     WHERE id IN (
       SELECT id FROM replenishment_schedules
       WHERE status = 'scheduled'
         AND trigger_date <= NOW()
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [limit]
  );
  return result.rows;
}

export async function updateScheduleStatus(
  id: string,
  status: ScheduleStatus,
  reason?: string
): Promise<void> {
  await query(
    `UPDATE replenishment_schedules
     SET status = $2,
         status_reason = $3,
         sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE NULL END
     WHERE id = $1`,
    [id, status, reason ?? null]
  );
  await appendLog(id, status, reason ? { reason } : undefined);
}

export async function isWebhookProcessed(webhookId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM processed_webhooks WHERE webhook_id = $1`,
    [webhookId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function markWebhookProcessed(webhookId: string): Promise<void> {
  await query(
    `INSERT INTO processed_webhooks (webhook_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [webhookId]
  );
}

export async function appendLog(
  scheduleId: string,
  event: string,
  details?: unknown
): Promise<void> {
  await query(
    `INSERT INTO replenishment_logs (schedule_id, event, details) VALUES ($1, $2, $3)`,
    [scheduleId, event, details ? JSON.stringify(details) : null]
  );
}

export async function listSchedules(
  page: number,
  pageSize: number,
  status?: string
): Promise<{ rows: ReplenishmentSchedule[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const conditions = status ? `WHERE status = $3` : '';
  const params: unknown[] = status
    ? [pageSize, offset, status]
    : [pageSize, offset];

  const [data, count] = await Promise.all([
    query<ReplenishmentSchedule>(
      `SELECT * FROM replenishment_schedules ${conditions}
       ORDER BY trigger_date DESC LIMIT $1 OFFSET $2`,
      params
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM replenishment_schedules ${conditions}`,
      status ? [status] : []
    ),
  ]);

  return {
    rows: data.rows,
    total: parseInt(count.rows[0]?.count ?? '0', 10),
  };
}

export async function getScheduleLogs(
  scheduleId: string
): Promise<{ event: string; details: unknown; created_at: Date }[]> {
  const result = await query<{ event: string; details: unknown; created_at: Date }>(
    `SELECT event, details, created_at FROM replenishment_logs
     WHERE schedule_id = $1 ORDER BY created_at ASC`,
    [scheduleId]
  );
  return result.rows;
}
