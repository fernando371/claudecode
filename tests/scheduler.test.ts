import { describe, it, expect } from 'vitest';
import { calcTriggerDate } from '../src/services/scheduler.js';

describe('calcTriggerDate', () => {
  it('adds reminder_delay_days to order_paid_at', () => {
    const paidAt = new Date('2025-01-01T00:00:00Z');
    const result = calcTriggerDate(paidAt, 30);
    expect(result.toISOString()).toBe('2025-01-31T00:00:00.000Z');
  });

  it('handles single-day delay', () => {
    const paidAt = new Date('2025-06-15T12:00:00Z');
    const result = calcTriggerDate(paidAt, 1);
    expect(result.getDate()).toBe(16);
    expect(result.getMonth()).toBe(5); // June = 5
  });

  it('handles zero delay (same day)', () => {
    const paidAt = new Date('2025-03-10T08:00:00Z');
    const result = calcTriggerDate(paidAt, 0);
    expect(result.toISOString()).toBe('2025-03-10T08:00:00.000Z');
  });

  it('handles month rollover', () => {
    const paidAt = new Date('2025-01-28T00:00:00Z');
    const result = calcTriggerDate(paidAt, 30);
    // Jan 28 + 30 days = Feb 27
    expect(result.toISOString()).toBe('2025-02-27T00:00:00.000Z');
  });

  it('handles year rollover', () => {
    const paidAt = new Date('2025-12-20T00:00:00Z');
    const result = calcTriggerDate(paidAt, 30);
    // Dec 20 + 30 days = Jan 19 2026
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(19);
  });

  it('does not mutate the input date', () => {
    const paidAt = new Date('2025-05-01T00:00:00Z');
    const original = paidAt.getTime();
    calcTriggerDate(paidAt, 60);
    expect(paidAt.getTime()).toBe(original);
  });
});
