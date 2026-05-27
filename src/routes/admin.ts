import { Hono } from 'hono';
import { listSchedules, getScheduleLogs } from '../services/scheduler.js';

export const adminRouter = new Hono();

// Simple bearer-token auth middleware
adminRouter.use('/*', async (c, next) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return c.json({ error: 'Admin not configured' }, 503);

  const auth = c.req.header('authorization') ?? '';
  if (auth !== `Bearer ${secret}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// GET /admin/schedules?page=1&page_size=20&status=scheduled
adminRouter.get('/schedules', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const pageSize = Math.min(100, parseInt(c.req.query('page_size') ?? '20', 10));
  const status = c.req.query('status');

  const { rows, total } = await listSchedules(page, pageSize, status);

  return c.json({
    data: rows,
    meta: {
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
  });
});

// GET /admin/schedules/:id/logs
adminRouter.get('/schedules/:id/logs', async (c) => {
  const id = c.req.param('id');
  const logs = await getScheduleLogs(id);
  return c.json({ data: logs });
});
