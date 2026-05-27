import crypto from 'crypto';

export function validateShopifyHmac(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}
