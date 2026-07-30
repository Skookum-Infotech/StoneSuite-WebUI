import { describe, it, expect } from 'vitest'
import { EMPTY_FILTER_STATE, hasActiveFilters, toFilterClauses, type JournalEntryFilterState } from './journalEntryFilters'

describe('hasActiveFilters', () => {
  it('is false for the empty state', () => {
    expect(hasActiveFilters(EMPTY_FILTER_STATE)).toBe(false)
  })
  it('is true when any single field is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTER_STATE, reference: 'Check #1042' })).toBe(true)
  })
  it('is true when a custom field value is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTER_STATE, customFields: { project: 'Acme' } })).toBe(true)
  })
  it('ignores custom field keys with an empty value', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTER_STATE, customFields: { project: '' } })).toBe(false)
  })
})

describe('toFilterClauses', () => {
  it('builds no clauses from the empty state', () => {
    expect(toFilterClauses(EMPTY_FILTER_STATE)).toEqual([])
  })

  it('maps text fields to a contains clause', () => {
    const state: JournalEntryFilterState = {
      ...EMPTY_FILTER_STATE,
      recordNumber: 'JE-1', reference: 'Check #1042',
    }
    expect(toFilterClauses(state)).toEqual([
      { field: 'record_number', op: 'contains', value: 'JE-1' },
      { field: 'reference', op: 'contains', value: 'Check #1042' },
    ])
  })

  it('builds a gte/lte pair for the date range', () => {
    const state: JournalEntryFilterState = {
      ...EMPTY_FILTER_STATE,
      transferDateFrom: '2026-01-01', transferDateTo: '2026-01-31',
    }
    expect(toFilterClauses(state)).toEqual([
      { field: 'transfer_date', op: 'gte', value: '2026-01-01' },
      { field: 'transfer_date', op: 'lte', value: '2026-01-31' },
    ])
  })

  it('builds a numeric gte/lte pair for the amount range', () => {
    const state: JournalEntryFilterState = { ...EMPTY_FILTER_STATE, amountMin: '100', amountMax: '500' }
    expect(toFilterClauses(state)).toEqual([
      { field: 'amount', op: 'gte', value: 100 },
      { field: 'amount', op: 'lte', value: 500 },
    ])
  })

  it('sends the owner id as-is (eq, not contains)', () => {
    expect(toFilterClauses({ ...EMPTY_FILTER_STATE, ownerId: '7' })).toEqual([
      { field: 'owner_id', op: 'eq', value: '7' },
    ])
  })

  it('prefixes custom field keys with cf: and skips blank values', () => {
    const state = { ...EMPTY_FILTER_STATE, customFields: { project: 'Acme', tag: '' } }
    expect(toFilterClauses(state)).toEqual([
      { field: 'cf:project', op: 'contains', value: 'Acme' },
    ])
  })
})
