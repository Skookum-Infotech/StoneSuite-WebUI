import { describe, it, expect } from 'vitest';
import {
  EMPTY_FILTER_STATE,
  hasActiveFilters,
  toFilterClauses,
  type VendorPaymentFilterState,
} from './vendorPaymentFilters';

function state(overrides: Partial<VendorPaymentFilterState> = {}): VendorPaymentFilterState {
  return { ...EMPTY_FILTER_STATE, ...overrides };
}

describe('hasActiveFilters', () => {
  it('is false for the empty state and true for any single populated field', () => {
    expect(hasActiveFilters(EMPTY_FILTER_STATE)).toBe(false);

    const populated: Partial<VendorPaymentFilterState>[] = [
      { recordNumber: 'VPAY' },
      { referenceNumber: 'CHK' },
      { paymentDateFrom: '2026-08-01' },
      { paymentDateTo: '2026-08-31' },
      { scheduledDateFrom: '2026-09-01' },
      { scheduledDateTo: '2026-09-30' },
      { amountMin: '10' },
      { amountMax: '99' },
      { unappliedMin: '1' },
      { unappliedMax: '5' },
      { approvalStatus: 'pending' },
      { methodId: '3' },
      { ownerId: '7' },
      { customFields: { po_ref: 'PO-1' } },
    ];
    for (const overrides of populated) {
      expect(hasActiveFilters(state(overrides))).toBe(true);
    }
  });

  it('ignores custom-field keys whose value is blank', () => {
    expect(hasActiveFilters(state({ customFields: { po_ref: '' } }))).toBe(false);
  });
});

describe('toFilterClauses', () => {
  it('emits nothing for the empty state', () => {
    expect(toFilterClauses(EMPTY_FILTER_STATE)).toEqual([]);
  });

  it('splits a range into paired gte/lte clauses on the same field', () => {
    expect(toFilterClauses(state({ paymentDateFrom: '2026-08-01', paymentDateTo: '2026-08-31' }))).toEqual([
      { field: 'payment_date', op: 'gte', value: '2026-08-01' },
      { field: 'payment_date', op: 'lte', value: '2026-08-31' },
    ]);
  });

  it('sends amount bounds as numbers, not the raw input strings', () => {
    expect(toFilterClauses(state({ amountMin: '10.5', unappliedMax: '99' }))).toEqual([
      { field: 'amount', op: 'gte', value: 10.5 },
      { field: 'unapplied_amount', op: 'lte', value: 99 },
    ]);
  });

  it('uses only field keys the vendor_payment resolver whitelists', () => {
    const clauses = toFilterClauses(state({
      recordNumber: 'VPAY-0001',
      referenceNumber: 'CHK-9',
      scheduledDateFrom: '2026-09-01',
      approvalStatus: 'approved',
      methodId: '3',
      ownerId: '7',
    }));
    const allowed = new Set([
      'record_number', 'reference_number', 'payment_date', 'scheduled_date',
      'amount', 'unapplied_amount', 'approval_status', 'method_id', 'owner_id',
    ]);
    expect(clauses.length).toBeGreaterThan(0);
    for (const clause of clauses) {
      expect(allowed.has(clause.field)).toBe(true);
    }
  });

  it('prefixes custom fields with cf: and skips blank values', () => {
    expect(toFilterClauses(state({ customFields: { po_ref: 'PO-42', note: '' } }))).toEqual([
      { field: 'cf:po_ref', op: 'contains', value: 'PO-42' },
    ]);
  });
});
