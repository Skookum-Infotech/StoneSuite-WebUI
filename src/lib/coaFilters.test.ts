import { describe, it, expect } from 'vitest'
import {
  EMPTY_ACCOUNT_TABLE_FILTER_STATE, hasActiveAccountFilters, toAccountFilterClauses,
  type AccountTableFilterState,
} from './coaFilters'

describe('hasActiveAccountFilters', () => {
  it('is false for the empty state', () => {
    expect(hasActiveAccountFilters(EMPTY_ACCOUNT_TABLE_FILTER_STATE)).toBe(false)
  })

  it.each<[keyof AccountTableFilterState, AccountTableFilterState[keyof AccountTableFilterState]]>([
    ['type', 'bank'],
    ['bsPnl', 'BS'],
    ['categoryCode', 1000],
    ['subCategoryCode', 1100],
    ['isSystem', 'true'],
  ])('is true when %s is set', (key, value) => {
    expect(hasActiveAccountFilters({ ...EMPTY_ACCOUNT_TABLE_FILTER_STATE, [key]: value })).toBe(true)
  })
})

describe('toAccountFilterClauses', () => {
  it('returns [] for the empty state', () => {
    expect(toAccountFilterClauses(EMPTY_ACCOUNT_TABLE_FILTER_STATE)).toEqual([])
  })

  it('builds one eq clause per set field', () => {
    const clauses = toAccountFilterClauses({
      type: 'bank', bsPnl: 'PNL', categoryCode: 4000, subCategoryCode: 4100, isSystem: 'false',
    })
    expect(clauses).toEqual([
      { field: 'type', op: 'eq', value: 'bank' },
      { field: 'bs_pnl', op: 'eq', value: 'PNL' },
      { field: 'category_code', op: 'eq', value: 4000 },
      { field: 'subcategory_code', op: 'eq', value: 4100 },
      { field: 'is_system', op: 'eq', value: false },
    ])
  })

  it('converts isSystem "true"/"false" strings to booleans', () => {
    expect(toAccountFilterClauses({ ...EMPTY_ACCOUNT_TABLE_FILTER_STATE, isSystem: 'true' }))
      .toEqual([{ field: 'is_system', op: 'eq', value: true }])
  })
})
