import { describe, it, expect } from 'vitest'
import { fromItemForCopy } from './inventoryItemCopy'
import type { InventoryItem } from '@/types/inventory'

const item = {
  sku: 'CAL-01', name: 'Calacatta Slab', description: 'Veined', unitId: 3, unitPrice: 55, purchaseUnitPrice: 40,
  isActive: false, tracking: 'quantity', barcode: '0123456789', trackStock: true, thicknessMm: 20,
  kits: [{ id: 'k-1', name: 'Kitchen Set' }],
} as unknown as InventoryItem

describe('fromItemForCopy', () => {
  const copy = fromItemForCopy(item)

  it.each([
    ['sku', ''],
    ['barcode', ''],
    ['is_active', true],
    ['name', 'Calacatta Slab (Copy)'],
  ])('resets %s', (key, expected) => {
    expect(copy[key]).toBe(expected)
  })

  it.each([
    ['description', 'Veined'],
    ['unit_id', '3'],
    ['unit_price', '55'],
    ['purchase_unit_price', '40'],
    ['thickness_mm', '20'],
  ])('keeps %s', (key, expected) => {
    expect(copy[key]).toBe(expected)
  })

  it('keeps the kits it belongs to', () => {
    expect(copy.kits).toEqual([{ id: 'k-1', name: 'Kitchen Set' }])
  })

  it('does not double the suffix when copying a copy', () => {
    expect(fromItemForCopy({ ...item, name: 'Calacatta Slab (Copy)' }).name).toBe('Calacatta Slab (Copy)')
  })
})
