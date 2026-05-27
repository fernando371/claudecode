import 'dotenv/config';
import { getDueSchedules, updateScheduleStatus } from '../services/scheduler.js';
import { preflightCheck, resolveProductUrl } from '../services/checker.js';
import { sendReplenishmentEmail } from '../services/email.js';
import { logger } from '../utils/logger.js';

const SHOP_NAME = process.env.SHOPIFY_SHOP_DOMAIN?.replace('.myshopify.com', '') ?? 'FDC Vitaminas';
const APP_URL = process.env.APP_URL ?? '';

export async function processSchedules(): Promise<void> {
  const schedules = await getDueSchedules(100);
  logger.info('Processing due schedules', { count: schedules.length });

  for (const schedule of schedules) {
    try {
      const check = await preflightCheck(schedule);

      if (!check.ok) {
        logger.info('Schedule skipped', { id: schedule.id, reason: check.reason });
        await updateScheduleStatus(schedule.id, check.reason);
        continue;
      }

      const productUrl = resolveProductUrl(check.product);

      await sendReplenishmentEmail(schedule.customer_email, {
        customer_first_name: schedule.customer_first_name ?? 'Cliente',
        product_title: schedule.product_title,
        product_url: productUrl,
        image_url: schedule.image_url ?? '',
        consumption_days: schedule.consumption_days,
        shop_name: SHOP_NAME,
        unsubscribe_url: `${APP_URL}/unsubscribe?email=${encodeURIComponent(schedule.customer_email)}`,
      });

      await updateScheduleStatus(schedule.id, 'sent');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to process schedule', { id: schedule.id, error: message });
      await updateScheduleStatus(schedule.id, 'failed', message);
    }
  }

  logger.info('Batch complete', { processed: schedules.length });
}

// Standalone runner (used by cron or CLI)
if (process.argv[1]?.endsWith('processSchedules.ts') ||
    process.argv[1]?.endsWith('processSchedules.js')) {
  processSchedules()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('processSchedules crashed', { error: String(err) });
      process.exit(1);
    });
}
