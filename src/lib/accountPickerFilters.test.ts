import { describe, it, expect } from 'vitest'
import { accountPickerTypeFilters } from './accountPickerFilters'

describe('accountPickerTypeFilters', () => {
  it('returns undefined when no types are given', () => {
    expect(accountPickerTypeFilters(undefined)).toBeUndefined()
  })

  it('returns undefined for an empty types array', () => {
    expect(accountPickerTypeFilters([])).toBeUndefined()
  })

  it('builds a single `type in [...]` filter clause for bank/cash', () => {
    expect(accountPickerTypeFilters(['bank', 'cash'])).toEqual([
      { field: 'type', op: 'in', value: ['bank', 'cash'] },
    ])
  })

  it('preserves a single-type restriction', () => {
    expect(accountPickerTypeFilters(['bank'])).toEqual([{ field: 'type', op: 'in', value: ['bank'] }])
  })
})
