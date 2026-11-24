import { describe, it, expect } from 'vitest';
import { formatNotificationTime, notificationRecordLabel } from './notificationRecord';

describe('notificationRecordLabel', () => {
  it.each([
    ['sales_order', 'Sales order'],
    ['vendor_bill', 'Vendor bill'],
    ['daily_digest', 'Daily digest'],
    ['purchase_order', 'Purchase order'],
    ['', 'Record'],
  ])('labels %s as %s', (resource, label) => {
    expect(notificationRecordLabel(resource)).toBe(label);
  });
});

describe('formatNotificationTime', () => {
  it('formats a date and time', () => {
    expect(formatNotificationTime('2026-11-24T15:05:00Z')).toMatch(/2026/);
  });
  it('returns nothing for an unreadable date', () => {
    expect(formatNotificationTime('nope')).toBe('');
  });
});
