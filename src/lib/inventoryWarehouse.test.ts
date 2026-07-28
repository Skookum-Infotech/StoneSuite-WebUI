import { describe, it, expect } from 'vitest'
import { toNumericWarehouseId } from './inventoryWarehouse'
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
