import { describe, it, expect } from 'vitest'
import { itemDefaults, toItemPayload, fromItem, validateItem } from './inventoryItemForm'
import { TRACKING_QUANTITY, TRACKING_SERIALIZED } from '@/types/inventory'
import type { InventoryItem } from '@/types/inventory'

describe('toItemPayload (whole-object write — PATCH has PUT semantics)', () => {
  it('maps every field the backend contract expects, never dropping one', () => {
    const data = {
      sku: ' GRAN-001 ', name: ' Absolute Black ', description: 'desc', unit_id: '6',
      unit_price: '42.5', currency_id: '1', tax_rate_id: '2', is_active: true,
      tracking: TRACKING_SERIALIZED, material_id: '3', color_id: '4', finish_id: '5',
      thickness_mm: '30', origin_country_id: '7', default_warehouse_id: '8', barcode: ' 012345 ',
    }
    const payload = toItemPayload(data)
    expect(payload).toEqual({
      sku: 'GRAN-001', name: 'Absolute Black', description: 'desc', unitId: 6, unitPrice: 42.5,
      currencyId: 1, taxRateId: 2, customFields: {}, tracking: TRACKING_SERIALIZED,
      materialId: 3, colorId: 4, finishId: 5, thicknessMm: 30, originCountryId: 7,
      barcode: '012345', defaultWarehouseId: 8,
    })
  })

  it('defaults tracking to quantity for anything other than the serialized literal', () => {
    expect(toItemPayload({ tracking: 'bogus' }).tracking).toBe(TRACKING_QUANTITY)
    expect(toItemPayload({}).tracking).toBe(TRACKING_QUANTITY)
  })

  it('maps blank optional ids to null, not 0 or NaN', () => {
    const payload = toItemPayload({ sku: 'x', name: 'y', unit_id: '1' })
    expect(payload.currencyId).toBeNull()
    expect(payload.taxRateId).toBeNull()
    expect(payload.materialId).toBeNull()
    expect(payload.colorId).toBeNull()
    expect(payload.finishId).toBeNull()
    expect(payload.originCountryId).toBeNull()
    expect(payload.defaultWarehouseId).toBeNull()
  })

  it('defaults a missing unit_id to 0 rather than NaN', () => {
    expect(toItemPayload({}).unitId).toBe(0)
  })
})

describe('fromItem / toItemPayload round-trip', () => {
  it('preserves every field through fromItem then toItemPayload', () => {
    const item: InventoryItem = {
      id: 'uuid-1', sku: 'SKU', name: 'Name', description: 'Desc', unitId: 6, unitPrice: 10,
      currencyId: 1, taxRateId: 2, isActive: true, customFields: {},
      tracking: TRACKING_SERIALIZED, materialId: 3, colorId: 4, finishId: 5,
      thicknessMm: 20, originCountryId: 7, barcode: 'BC1', defaultWarehouseId: 8,
      createdAt: '2026-01-01', updatedAt: '2026-01-02',
    }
    const payload = toItemPayload(fromItem(item))
    expect(payload).toEqual({
      sku: 'SKU', name: 'Name', description: 'Desc', unitId: 6, unitPrice: 10,
      currencyId: 1, taxRateId: 2, customFields: {}, tracking: TRACKING_SERIALIZED,
      materialId: 3, colorId: 4, finishId: 5, thicknessMm: 20, originCountryId: 7,
      barcode: 'BC1', defaultWarehouseId: 8,
    })
  })
})

describe('itemDefaults', () => {
  it('defaults to quantity tracking and zeroed numeric fields', () => {
    const d = itemDefaults()
    expect(d.tracking).toBe(TRACKING_QUANTITY)
    expect(d.unit_price).toBe('0')
    expect(d.thickness_mm).toBe('0')
    expect(d.is_active).toBe(true)
  })
})

describe('validateItem', () => {
  it('requires sku, name and unit', () => {
    const errors = validateItem({})
    expect(errors.map((e) => e.key)).toEqual(['sku', 'name', 'unit_id'])
  })

  it('passes once all three are present', () => {
    expect(validateItem({ sku: 'x', name: 'y', unit_id: '1' })).toEqual([])
  })

  it('treats whitespace-only sku/name as missing', () => {
    const errors = validateItem({ sku: '   ', name: '  ', unit_id: '1' })
    expect(errors.map((e) => e.key)).toEqual(['sku', 'name'])
  })
})
