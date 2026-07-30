import { describe, it, expect } from 'vitest'
import { itemDefaults, toItemPayload, fromItem, validateItem } from './inventoryItemForm'
import { TRACKING_QUANTITY, TRACKING_SERIALIZED } from '@/types/inventory'
import type { InventoryItem, Warehouse } from '@/types/inventory'

// Warehouse lookups only expose the uuid today — `warehouseId` is the
// not-yet-shipped numeric id `toNumericWarehouseId` is written to pick up
// once the backend attaches it (see lib/inventoryWarehouse.ts).
const warehouseWithNumericId: Warehouse & { warehouseId: number } = {
  id: 'wh-uuid-8', name: 'Main', code: 'MAIN', addrLine1: '', addrLine2: '', addrCity: '',
  addrZip: '', isDefault: true, isActive: true, isSystem: false, warehouseId: 8,
}

describe('toItemPayload (whole-object write — PATCH has PUT semantics)', () => {
  it('maps every field the backend contract expects, never dropping one', () => {
    const data = {
      sku: ' GRAN-001 ', name: ' Absolute Black ', description: 'desc', unit_id: '6',
      unit_price: '42.5', currency_id: '1', tax_rate_id: '2', is_active: true,
      tracking: TRACKING_SERIALIZED, material_id: '3', color_id: '4', finish_id: '5',
      thickness_mm: '30', origin_country_id: '7', default_warehouse_id: 'wh-uuid-8', barcode: ' 012345 ',
    }
    const payload = toItemPayload(data, [warehouseWithNumericId])
    expect(payload).toEqual({
      sku: 'GRAN-001', name: 'Absolute Black', description: 'desc', unitId: 6, unitPrice: 42.5,
      currencyId: 1, taxRateId: 2, customFields: {}, tracking: TRACKING_SERIALIZED,
      materialId: 3, colorId: 4, finishId: 5, thicknessMm: 30, originCountryId: 7,
      barcode: '012345', defaultWarehouseId: 8,
    })
  })

  it('resolves default_warehouse_id to null rather than parsing the uuid as an int (regression)', () => {
    // Bug: default_warehouse_id holds the warehouse UUID (WarehouseSelect's
    // only available id). Running it through parseInt used to silently
    // truncate to the uuid's leading digit run (e.g. "9044xxxx-..." -> 9044),
    // POSTing a garbage-but-plausible id that fails the FK check server-side.
    const payload = toItemPayload({ sku: 'x', name: 'y', unit_id: '1', default_warehouse_id: '9044c3e1-aaaa-bbbb-cccc-000000000000' })
    expect(payload.defaultWarehouseId).toBeNull()
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
    const payload = toItemPayload(fromItem(item, [warehouseWithNumericId]), [warehouseWithNumericId])
    expect(payload).toEqual({
      sku: 'SKU', name: 'Name', description: 'Desc', unitId: 6, unitPrice: 10,
      currencyId: 1, taxRateId: 2, customFields: {}, tracking: TRACKING_SERIALIZED,
      materialId: 3, colorId: 4, finishId: 5, thicknessMm: 20, originCountryId: 7,
      barcode: 'BC1', defaultWarehouseId: 8,
    })
  })

  it('falls back to an unselected warehouse when the numeric id has no matching uuid yet (KNOWN GAP)', () => {
    const item: InventoryItem = {
      id: 'uuid-1', sku: 'SKU', name: 'Name', description: '', unitId: 6, unitPrice: 10,
      isActive: true, customFields: {}, tracking: TRACKING_QUANTITY, thicknessMm: 0,
      barcode: '', defaultWarehouseId: 8, createdAt: '2026-01-01', updatedAt: '2026-01-02',
    }
    expect(fromItem(item, []).default_warehouse_id).toBe('')
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
