import { describe, it, expect } from 'vitest'
import { EMPTY_FILTER_STATE, hasActiveFilters, toFilterClauses, type ItemReceiptFilterState } from './itemReceiptFilters'

describe('hasActiveFilters', () => {
  it('is false for the empty state', () => {
    expect(hasActiveFilters(EMPTY_FILTER_STATE)).toBe(false)
  })
  it('is true when any single field is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTER_STATE, carrier: 'FedEx' })).toBe(true)
  })
  it('is true when a custom field value is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTER_STATE, customFields: { color: 'red' } })).toBe(true)
  })
  it('ignores custom field keys with an empty value', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTER_STATE, customFields: { color: '' } })).toBe(false)
  })
})

describe('toFilterClauses', () => {
  it('builds no clauses from the empty state', () => {
    expect(toFilterClauses(EMPTY_FILTER_STATE)).toEqual([])
  })

  it('maps each text field to a contains clause', () => {
    const state: ItemReceiptFilterState = {
      ...EMPTY_FILTER_STATE,
      recordNumber: 'IRCT-1', purchaseOrderNumber: 'PORD-1', vendorName: 'Acme',
      packingSlip: 'PS-1', carrier: 'FedEx', trackingNumber: 'TRK-1',
    }
    expect(toFilterClauses(state)).toEqual([
      { field: 'record_number', op: 'contains', value: 'IRCT-1' },
      { field: 'purchase_order_number', op: 'contains', value: 'PORD-1' },
      { field: 'vendor_name', op: 'contains', value: 'Acme' },
      { field: 'packing_slip', op: 'contains', value: 'PS-1' },
      { field: 'carrier', op: 'contains', value: 'FedEx' },
      { field: 'tracking_number', op: 'contains', value: 'TRK-1' },
    ])
  })

  it('builds a gte/lte pair for each date range', () => {
    const state: ItemReceiptFilterState = {
      ...EMPTY_FILTER_STATE,
      receiptDateFrom: '2026-01-01', receiptDateTo: '2026-01-31',
    }
    expect(toFilterClauses(state)).toEqual([
      { field: 'receipt_date', op: 'gte', value: '2026-01-01' },
      { field: 'receipt_date', op: 'lte', value: '2026-01-31' },
    ])
  })

  it('sends the owner id as-is (eq, not contains)', () => {
    expect(toFilterClauses({ ...EMPTY_FILTER_STATE, ownerId: '7' })).toEqual([
      { field: 'owner_id', op: 'eq', value: '7' },
    ])
  })

  it('prefixes custom field keys with cf: and skips blank values', () => {
    const state = { ...EMPTY_FILTER_STATE, customFields: { color: 'red', size: '' } }
    expect(toFilterClauses(state)).toEqual([
      { field: 'cf:color', op: 'contains', value: 'red' },
    ])
  })
})
