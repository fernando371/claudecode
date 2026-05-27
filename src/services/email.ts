import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
import type { EmailTemplateVars } from '../types/index.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is required');
    resendClient = new Resend(key);
  }
  return resendClient;
}

function loadTemplate(): string {
  const templatePath = join(__dirname, '..', '..', 'templates', 'replenishment-reminder.html');
  return readFileSync(templatePath, 'utf8');
}

function renderTemplate(vars: EmailTemplateVars): string {
  let html = loadTemplate();
  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(`{{${key}}}`, String(value));
  }
  return html;
}

export async function sendReplenishmentEmail(
  to: string,
  vars: EmailTemplateVars
): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'noreply@fdcvitaminas.com.br';
  const fromName = process.env.EMAIL_FROM_NAME ?? 'FDC Vitaminas';
  const html = renderTemplate(vars);

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: `${fromName} <${from}>`,
    to,
    subject: `Hora de repor: ${vars.product_title}`,
    html,
  });

  if (error) {
    logger.error('Resend send failed', { to, error });
    throw new Error(`Email send failed: ${error.message}`);
  }

  logger.info('Replenishment email sent', { to, product: vars.product_title });
}
