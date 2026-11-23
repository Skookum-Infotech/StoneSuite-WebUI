import { describe, it, expect } from 'vitest'
import { unitCategory, requiresDimensions, isAreaUnit, findUnit, unitCodeFor } from './inventoryUnits'
import type { LookupItem } from '@/types/inventory'

function unit(category: unknown): Pick<LookupItem, 'extra'> {
  return { extra: { category } }
}

describe('unitCategory', () => {
  it.each([
    ['count', 'count'],
    ['length', 'length'],
    ['area', 'area'],
    ['volume', 'volume'],
    ['weight', 'weight'],
  ])('reads extra.category %p -> %p', (category, expected) => {
    expect(unitCategory(unit(category))).toBe(expected)
  })

  it('defaults to count for a missing category', () => {
    expect(unitCategory(unit(undefined))).toBe('count')
  })

  it('defaults to count for an unrecognized category (never silently demands dimensions)', () => {
    expect(unitCategory(unit('bogus'))).toBe('count')
  })

  it('defaults to count when the unit itself is missing', () => {
    expect(unitCategory(undefined)).toBe('count')
    expect(unitCategory(null)).toBe('count')
  })
})

describe('requiresDimensions', () => {
  it('a count item must not prompt for dimensions', () => {
    expect(requiresDimensions(unit('count'))).toBe(false)
  })

  it.each(['length', 'area', 'volume', 'weight'])('%p prompts for dimensions', (category) => {
    expect(requiresDimensions(unit(category))).toBe(true)
  })
})

describe('isAreaUnit', () => {
  it('only area is an area unit', () => {
    expect(isAreaUnit(unit('area'))).toBe(true)
    expect(isAreaUnit(unit('length'))).toBe(false)
    expect(isAreaUnit(unit('count'))).toBe(false)
    expect(isAreaUnit(undefined)).toBe(false)
  })
})

describe('findUnit', () => {
  const units: LookupItem[] = [
    { id: 1, name: 'Square Foot', code: 'SQFT', isActive: true, isSystem: true, extra: { category: 'area' } },
    { id: 2, name: 'Each', code: 'EA', isActive: true, isSystem: true, extra: { category: 'count' } },
  ]

  it('finds by id', () => {
    expect(findUnit(units, 2)?.code).toBe('EA')
  })

  it('returns undefined for a missing or null/undefined id', () => {
    expect(findUnit(units, 999)).toBeUndefined()
    expect(findUnit(units, null)).toBeUndefined()
    expect(findUnit(units, undefined)).toBeUndefined()
  })
})

describe('unitCodeFor', () => {
  const units = [
    { id: 1, name: 'Each', code: 'EA', isActive: true, isSystem: true },
    { id: 6, name: 'Square Foot', code: 'SQFT', isActive: true, isSystem: true },
  ] as LookupItem[]

  it('gives the code for an item\'s unit id', () => {
    expect(unitCodeFor(units, 6)).toBe('SQFT')
    expect(unitCodeFor(units, 1)).toBe('EA')
  })

  it.each([[99], [null], [undefined]])('is blank for %s', (id) => {
    expect(unitCodeFor(units, id)).toBe('')
  })

  it('is blank before the lookups load', () => {
    expect(unitCodeFor([], 6)).toBe('')
  })
})
