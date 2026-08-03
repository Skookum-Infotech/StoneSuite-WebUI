import { describe, it, expect } from 'vitest'
import { EMPTY_FILTER_STATE, hasActiveFilters, toFilterClauses } from './inventoryItemFilters'

describe('hasActiveFilters', () => {
  it('is false for the empty state', () => {
    expect(hasActiveFilters(EMPTY_FILTER_STATE)).toBe(false)
  })

  it('is true once any single field is set', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTER_STATE, sku: 'GRAN' })).toBe(true)
    expect(hasActiveFilters({ ...EMPTY_FILTER_STATE, thicknessMin: '20' })).toBe(true)
  })
})

describe('toFilterClauses', () => {
  it('builds no clauses from the empty state', () => {
    expect(toFilterClauses(EMPTY_FILTER_STATE)).toEqual([])
  })

  it('maps thickness_mm range to a gte/lte pair — "20mm vs 30mm" is a real range query', () => {
    const clauses = toFilterClauses({ ...EMPTY_FILTER_STATE, thicknessMin: '20', thicknessMax: '30' })
    expect(clauses).toEqual([
      { field: 'thickness_mm', op: 'gte', value: 20 },
      { field: 'thickness_mm', op: 'lte', value: 30 },
    ])
  })

  it('maps unit_price range independently of thickness', () => {
    const clauses = toFilterClauses({ ...EMPTY_FILTER_STATE, unitPriceMin: '5' })
    expect(clauses).toEqual([{ field: 'unit_price', op: 'gte', value: 5 }])
  })

  it('sends id filters as numbers, not strings', () => {
    const clauses = toFilterClauses({ ...EMPTY_FILTER_STATE, materialId: '3', colorId: '4' })
    expect(clauses).toEqual([
      { field: 'material_id', op: 'eq', value: 3 },
      { field: 'color_id', op: 'eq', value: 4 },
    ])
  })

  it('sends isActive as a real boolean', () => {
    expect(toFilterClauses({ ...EMPTY_FILTER_STATE, isActive: 'true' })).toEqual([
      { field: 'is_active', op: 'eq', value: true },
    ])
    expect(toFilterClauses({ ...EMPTY_FILTER_STATE, isActive: 'false' })).toEqual([
      { field: 'is_active', op: 'eq', value: false },
    ])
  })

  it('uses contains for free-text fields', () => {
    expect(toFilterClauses({ ...EMPTY_FILTER_STATE, sku: 'GRAN', barcode: '123' })).toEqual([
      { field: 'sku', op: 'contains', value: 'GRAN' },
      { field: 'barcode', op: 'contains', value: '123' },
    ])
  })
})
