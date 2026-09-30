import { describe, it, expect } from 'vitest'
import { toNumericWarehouseId, toWarehouseUuid, defaultWarehouseUuid } from './inventoryWarehouse'
import type { Warehouse } from '@/types/inventory'

const EMPTY_ADDRESS = { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' }

const location = (over: Partial<Warehouse>): Warehouse => ({
  id: 'uuid-1', warehouseId: 1, name: 'Main', phone: '', address: EMPTY_ADDRESS, isDefault: false, ...over,
})

const locations: Warehouse[] = [
  location({ id: 'uuid-1', warehouseId: 1, isDefault: true }),
  location({ id: 'uuid-2', warehouseId: 2, name: 'Yard' }),
]

describe('toNumericWarehouseId', () => {
  it('returns the numeric id for a known uuid', () => {
    expect(toNumericWarehouseId(locations, 'uuid-2')).toBe(2)
  })

  it('returns 0 (an id the server rejects) for an unknown uuid', () => {
    expect(toNumericWarehouseId(locations, 'uuid-missing')).toBe(0)
  })

  it('returns 0 while the lookups have not loaded', () => {
    expect(toNumericWarehouseId([], 'uuid-1')).toBe(0)
  })
})

describe('toWarehouseUuid', () => {
  it('resolves a numeric id back to its uuid', () => {
    expect(toWarehouseUuid(locations, 2)).toBe('uuid-2')
  })

  it.each([[null], [undefined], [99]])('is empty for %s (nothing to match)', (id) => {
    expect(toWarehouseUuid(locations, id)).toBe('')
  })

  it('is empty while the lookups have not loaded', () => {
    expect(toWarehouseUuid([], 1)).toBe('')
  })

  it('round-trips with toNumericWarehouseId', () => {
    expect(toWarehouseUuid(locations, toNumericWarehouseId(locations, 'uuid-2'))).toBe('uuid-2')
  })
})

describe('defaultWarehouseUuid', () => {
  it("picks the tenant's default location", () => {
    const list = [location({ id: 'a', warehouseId: 1 }), location({ id: 'b', warehouseId: 2, isDefault: true })]
    expect(defaultWarehouseUuid(list)).toBe('b')
  })

  it('is empty when none is the default, or there are no locations', () => {
    expect(defaultWarehouseUuid([location({ isDefault: false })])).toBe('')
    expect(defaultWarehouseUuid([])).toBe('')
  })
})
