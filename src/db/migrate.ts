import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool } from './client.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const sql = readFileSync(
    join(__dirname, 'migrations', '001_initial.sql'),
    'utf8'
  );
  logger.info('Running migration 001_initial.sql');
  await pool.query(sql);
  logger.info('Migration complete');
  await pool.end();
}

migrate().catch((err) => {
  logger.error('Migration failed', { message: err.message });
  process.exit(1);
});
