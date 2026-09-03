import { describe, it, expect } from 'vitest'
import { formatAlertDetail, formatStockQty } from './inventoryAlert'
import type { InventoryStockAlert } from '@/types/dashboardData'

function makeAlert(overrides: Partial<InventoryStockAlert> = {}): InventoryStockAlert {
  return {
    id: 'item-1', itemName: 'Black Galaxy Slab', warehouse: 'Warehouse 1',
    onHand: 4, allocated: 10, reorderPoint: 0, severity: 'short',
    ...overrides,
  }
}

describe('formatAlertDetail', () => {
  it('shows what is committed for a short alert', () => {
    expect(formatAlertDetail(makeAlert({ severity: 'short', warehouse: 'Warehouse 1', allocated: 6 }))).toBe(
      'Warehouse 1 · 6 committed',
    )
  })

  it('shows only the warehouse for an out alert', () => {
    expect(formatAlertDetail(makeAlert({ severity: 'out', warehouse: 'Warehouse 2', onHand: 0, allocated: 0 }))).toBe(
      'Warehouse 2',
    )
  })

  it('shows the configured reorder point for a low alert', () => {
    expect(formatAlertDetail(makeAlert({ severity: 'low', warehouse: 'Warehouse 2', reorderPoint: 12 }))).toBe(
      'Warehouse 2 · reorder at 12',
    )
  })
})

describe('formatStockQty', () => {
  it('renders a whole number without decimals', () => {
    expect(formatStockQty(12)).toBe('12')
  })

  it('renders zero as "0"', () => {
    expect(formatStockQty(0)).toBe('0')
  })

  it('trims a fractional quantity to at most one decimal', () => {
    expect(formatStockQty(6.5)).toBe('6.5')
  })

  it('rounds noisy floating point to one decimal', () => {
    expect(formatStockQty(6.499999999)).toBe('6.5')
  })
})
