import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from './utils/logger.js';
import { webhookRouter } from './routes/webhook.js';
import { adminRouter } from './routes/admin.js';
import { processSchedules } from './jobs/processSchedules.js';

const app = new Hono();

// Health check
app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// Shopify webhooks
app.route('/webhooks', webhookRouter);

// Admin API
app.route('/admin', adminRouter);

// Vercel cron endpoint (requires CRON_SECRET header set by Vercel)
app.get('/api/cron/process', async (c) => {
  const cronSecret = c.req.header('authorization');
  if (process.env.NODE_ENV === 'production' &&
      cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await processSchedules();
  return c.json({ ok: true });
});

const port = parseInt(process.env.PORT ?? '3000', 10);
serve({ fetch: app.fetch, port }, () => {
  logger.info(`FDC Replenishment Worker running on port ${port}`);
});

export default app;
