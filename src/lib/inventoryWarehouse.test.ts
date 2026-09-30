import { describe, it, expect } from 'vitest'
import { toNumericWarehouseId, toWarehouseUuid, defaultWarehouseUuid } from './inventoryWarehouse'
import type { Warehouse } from '@/types/inventory'

const warehouses: Warehouse[] = [
  { id: 'uuid-1', name: 'Main', code: 'MAIN', addrLine1: '', addrLine2: '', addrCity: '', addrZip: '', isDefault: true, isActive: true, isSystem: false },
];

describe('toNumericWarehouseId', () => {
  it('returns 0 for a known uuid until the backend exposes a numeric id (KNOWN GAP)', () => {
    expect(toNumericWarehouseId(warehouses, 'uuid-1')).toBe(0)
  })

  it('returns 0 for an unknown uuid', () => {
    expect(toNumericWarehouseId(warehouses, 'uuid-missing')).toBe(0)
  })

  it('picks up a numeric id once the backend attaches one to the record', () => {
    const withNumericId = [{ ...warehouses[0], warehouseId: 42 } as Warehouse & { warehouseId: number }];
    expect(toNumericWarehouseId(withNumericId, 'uuid-1')).toBe(42)
  })
})

describe('toWarehouseUuid', () => {
  const numbered: Warehouse[] = [
    { ...warehouses[0], id: 'uuid-1', warehouseId: 1 },
    { ...warehouses[0], id: 'uuid-2', warehouseId: 2, isDefault: false },
  ]

  it('resolves a numeric id back to its uuid', () => {
    expect(toWarehouseUuid(numbered, 2)).toBe('uuid-2')
  })

  it.each([[null], [undefined], [99]])('is empty for %s (nothing to match)', (id) => {
    expect(toWarehouseUuid(numbered, id)).toBe('')
  })

  it('is empty while the lookups have not loaded', () => {
    expect(toWarehouseUuid([], 1)).toBe('')
  })

  it('round-trips with toNumericWarehouseId', () => {
    expect(toWarehouseUuid(numbered, toNumericWarehouseId(numbered, 'uuid-2'))).toBe('uuid-2')
  })
})

describe('defaultWarehouseUuid', () => {
  it('picks the default active warehouse', () => {
    const list: Warehouse[] = [
      { ...warehouses[0], id: 'a', isDefault: false },
      { ...warehouses[0], id: 'b', isDefault: true },
    ]
    expect(defaultWarehouseUuid(list)).toBe('b')
  })

  it('ignores an inactive default', () => {
    expect(defaultWarehouseUuid([{ ...warehouses[0], isDefault: true, isActive: false }])).toBe('')
  })

  it('is empty when none is the default', () => {
    expect(defaultWarehouseUuid([{ ...warehouses[0], isDefault: false }])).toBe('')
    expect(defaultWarehouseUuid([])).toBe('')
  })
})
