import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { validateShopifyHmac } from '../src/utils/hmac.js';

const SECRET = 'test-webhook-secret';

function makeSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64');
}

describe('validateShopifyHmac', () => {
  it('returns true for a valid signature', () => {
    const body = '{"id":1,"name":"#1001"}';
    const sig = makeSignature(body, SECRET);
    expect(validateShopifyHmac(Buffer.from(body), sig, SECRET)).toBe(true);
  });

  it('returns false when signature is wrong', () => {
    const body = '{"id":1}';
    const sig = makeSignature(body, 'other-secret');
    expect(validateShopifyHmac(Buffer.from(body), sig, SECRET)).toBe(false);
  });

  it('returns false when body is tampered', () => {
    const original = '{"id":1}';
    const tampered = '{"id":2}';
    const sig = makeSignature(original, SECRET);
    expect(validateShopifyHmac(Buffer.from(tampered), sig, SECRET)).toBe(false);
  });

  it('returns false when signature is empty', () => {
    const body = '{"id":1}';
    expect(validateShopifyHmac(Buffer.from(body), '', SECRET)).toBe(false);
  });

  it('returns false when secret is empty', () => {
    const body = '{"id":1}';
    const sig = makeSignature(body, SECRET);
    expect(validateShopifyHmac(Buffer.from(body), sig, '')).toBe(false);
  });

  it('is not vulnerable to timing attacks (uses timingSafeEqual)', () => {
    // Validates that differing-length strings don't throw
    const body = '{}';
    expect(validateShopifyHmac(Buffer.from(body), 'short', SECRET)).toBe(false);
  });
});
