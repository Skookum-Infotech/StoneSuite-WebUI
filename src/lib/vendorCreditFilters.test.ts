import { describe, it, expect } from 'vitest';
import {
  EMPTY_FILTER_STATE,
  hasActiveFilters,
  toFilterClauses,
  type VendorCreditFilterState,
} from './vendorCreditFilters';

function state(overrides: Partial<VendorCreditFilterState> = {}): VendorCreditFilterState {
  return { ...EMPTY_FILTER_STATE, ...overrides };
}

describe('hasActiveFilters', () => {
  it('is false for the empty state and true for any single populated field', () => {
    expect(hasActiveFilters(EMPTY_FILTER_STATE)).toBe(false);

    const populated: Partial<VendorCreditFilterState>[] = [
      { recordNumber: 'VCR' },
      { referenceNumber: 'RMA' },
      { reason: 'defective' },
      { creditDateFrom: '2026-08-01' },
      { creditDateTo: '2026-08-31' },
      { amountMin: '10' },
      { amountMax: '99' },
      { unappliedMin: '1' },
      { unappliedMax: '5' },
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
    expect(toFilterClauses(state({ creditDateFrom: '2026-08-01', creditDateTo: '2026-08-31' }))).toEqual([
      { field: 'credit_date', op: 'gte', value: '2026-08-01' },
      { field: 'credit_date', op: 'lte', value: '2026-08-31' },
    ]);
  });

  it('sends amount bounds as numbers, not the raw input strings', () => {
    expect(toFilterClauses(state({ amountMin: '10.5', unappliedMax: '99' }))).toEqual([
      { field: 'grand_total', op: 'gte', value: 10.5 },
      { field: 'unapplied_amount', op: 'lte', value: 99 },
    ]);
  });

  it('uses only field keys the vendor_credit resolver whitelists', () => {
    const clauses = toFilterClauses(state({
      recordNumber: 'VCR-0001',
      referenceNumber: 'RMA-9',
      reason: 'defective',
      ownerId: '7',
    }));
    const allowed = new Set([
      'record_number', 'reference_number', 'reason', 'credit_date',
      'grand_total', 'unapplied_amount', 'owner_id',
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
