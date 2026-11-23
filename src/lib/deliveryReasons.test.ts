import { describe, it, expect } from 'vitest';
import { DELIVERY_REASON_COPY, deliveryReasonLabel } from './deliveryReasons';
import { documentLabel, documentLink, hasDeliveryError, stageText } from './automationDeliveries';

// Every reason the backend's automation package writes (guards.go Reason* plus the reason* constants).
const BACKEND_REASONS = [
  'kill_switch', 'cap', 'suppressed', 'stale', 'superseded', 'rule_disabled', 'pre_enable', 'paid', 'voided',
  'not_sent', 'not_pending', 'converted', 'no_email', 'do_not_contact', 'ar_hold', 'credit_covers',
  'anchor_changed', 'recipient_changed', 'owner_changed', 'not_rendered',
];

describe('deliveryReasonLabel', () => {
  it.each(BACKEND_REASONS)('has copy for %s', (reason) => {
    expect(DELIVERY_REASON_COPY[reason]).toBeTruthy();
    expect(deliveryReasonLabel(reason)).toBe(DELIVERY_REASON_COPY[reason]);
  });

  it.each([
    ['kill_switch', 'Paused by workspace switch'],
    ['cap', 'Daily or weekly limit reached (will retry)'],
    ['not_sent', 'Document no longer Sent'],
    ['owner_changed', 'Details changed; replanned'],
  ])('%s -> %s', (reason, copy) => {
    expect(deliveryReasonLabel(reason)).toBe(copy);
  });

  it('renders an unknown code raw and nothing for null', () => {
    expect(deliveryReasonLabel('brand_new_reason')).toBe('brand_new_reason');
    expect(deliveryReasonLabel(null)).toBe('');
  });
});

describe('delivery display helpers', () => {
  it.each([
    [{ resource: 'invoice', recordId: 'abc' }, '/sales/invoice/abc'],
    [{ resource: 'quote', recordId: 'abc' }, '/sales/quote/abc'],
    [{ resource: 'estimate', recordId: 'abc' }, '/sales/estimate/abc'],
    [{ resource: 'purchase_order', recordId: 'abc' }, '/purchases/purchase_order/abc'],
    [{ resource: 'mystery', recordId: 'abc' }, null],
  ])('documentLink(%o) -> %s', (d, expected) => {
    expect(documentLink(d)).toBe(expected);
  });

  it('documentLabel prefers the record number, else a short id', () => {
    expect(documentLabel({ recordNumber: 'INV-7', recordId: '12345678-aaaa' })).toBe('INV-7');
    expect(documentLabel({ recordId: '12345678-aaaa' })).toBe('12345678');
    expect(documentLabel({ recordNumber: '', recordId: '12345678-aaaa' })).toBe('12345678');
  });

  it.each([
    [1, 4, 'Reminder 2 of 4'],
    [0, 3, 'Reminder 1 of 3'],
    [5, 3, 'Reminder 6'],
    [1, undefined, 'Reminder 2'],
  ])('stageText(%i, %s) -> %s', (stage, len, expected) => {
    expect(stageText(stage, len)).toBe(expected);
  });

  it('only failed/dead/unknown rows with an error expand', () => {
    expect(hasDeliveryError({ status: 'failed', lastError: 'boom' })).toBe(true);
    expect(hasDeliveryError({ status: 'dead', lastError: 'boom' })).toBe(true);
    expect(hasDeliveryError({ status: 'sent', lastError: 'boom' })).toBe(false);
    expect(hasDeliveryError({ status: 'failed', lastError: null })).toBe(false);
  });
});
