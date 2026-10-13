import { describe, it, expect } from 'vitest'
import { itemDefaults, toItemPayload, fromItem, validateItem } from './inventoryItemForm'
import { TRACKING_QUANTITY, TRACKING_SERIALIZED } from '@/types/inventory'
import type { InventoryItem, Warehouse } from '@/types/inventory'

// A location as the lookups return it: the uuid (`id`) a picker binds to plus
// the numeric `warehouseId` the write contracts take (see lib/inventoryWarehouse.ts).
const warehouseWithNumericId: Warehouse = {
  id: 'wh-uuid-8', warehouseId: 8, name: 'Main', phone: '',
  address: { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' },
  isDefault: true,
}

describe('toItemPayload (whole-object write — PATCH has PUT semantics)', () => {
  it('maps every field the backend contract expects, never dropping one', () => {
    const data = {
      sku: ' GRAN-001 ', name: ' Absolute Black ', description: 'desc', unit_id: '6',
      unit_price: '42.5', purchase_unit_price: '30', currency_id: '1', tax_rate_id: '2', is_active: true,
      tracking: TRACKING_SERIALIZED, material_id: '3', color_id: '4', finish_id: '5',
      thickness_mm: '30', origin_country_id: '7', default_warehouse_id: 'wh-uuid-8', barcode: ' 012345 ',
    }
    const payload = toItemPayload(data, [warehouseWithNumericId])
    expect(payload).toEqual({
      sku: 'GRAN-001', name: 'Absolute Black', description: 'desc', unitId: 6, unitPrice: 42.5,
      purchaseUnitPrice: 30, currencyId: 1, taxRateId: 2, customFields: {}, tracking: TRACKING_SERIALIZED,
      materialId: 3, colorId: 4, finishId: 5, thicknessMm: 30, originCountryId: 7,
      barcode: '012345', defaultWarehouseId: 8, trackStock: true, kitIds: [],
    })
  })

  it('sends the ids of the kits chosen on the form, always — even none', () => {
    const base = { sku: 'x', name: 'y', unit_id: '1' }
    expect(toItemPayload({ ...base, kits: [{ id: 'k1', name: 'Kitchen' }, { id: 'k2', name: 'Bath' }] }).kitIds)
      .toEqual(['k1', 'k2'])
    expect(toItemPayload({ ...base, kits: [] }).kitIds).toEqual([])
    // A form that never set it (older state) sends the empty list, not nothing,
    // so a save is always the whole truth about the item's kits.
    expect(toItemPayload(base).kitIds).toEqual([])
  })

  it('ignores a kits value that is not a list of kits', () => {
    expect(toItemPayload({ sku: 'x', name: 'y', unit_id: '1', kits: 'Kitchen' }).kitIds).toEqual([])
    expect(toItemPayload({ sku: 'x', name: 'y', unit_id: '1', kits: [null, { name: 'no id' }] }).kitIds).toEqual([])
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

describe('trackStock', () => {
  it('is on for a new item', () => {
    expect(itemDefaults().track_stock).toBe(true)
    expect(toItemPayload(itemDefaults()).trackStock).toBe(true)
  })

  it('sends off when the item is switched off', () => {
    expect(toItemPayload({ tracking: TRACKING_QUANTITY, track_stock: false }).trackStock).toBe(false)
  })

  it('reads as on when the form never set it', () => {
    expect(toItemPayload({ tracking: TRACKING_QUANTITY }).trackStock).toBe(true)
  })

  it('is always on for a slab item, whatever was chosen', () => {
    expect(toItemPayload({ tracking: TRACKING_SERIALIZED, track_stock: false }).trackStock).toBe(true)
  })

  it('loads an item as it was saved, and an item without the field as on', () => {
    const base: InventoryItem = {
      id: 'u', sku: 'S', name: 'N', description: '', unitId: 1, unitPrice: 0, isActive: true, customFields: {},
      tracking: TRACKING_QUANTITY, thicknessMm: 0, barcode: '', createdAt: 'a', updatedAt: 'b',
    }
    expect(fromItem({ ...base, trackStock: false }).track_stock).toBe(false)
    expect(fromItem({ ...base, trackStock: true }).track_stock).toBe(true)
    expect(fromItem(base).track_stock).toBe(true)
  })
})

describe('fromItem / toItemPayload round-trip', () => {
  it('preserves every field through fromItem then toItemPayload', () => {
    const item: InventoryItem = {
      id: 'uuid-1', sku: 'SKU', name: 'Name', description: 'Desc', unitId: 6, unitPrice: 10,
      purchaseUnitPrice: 7, currencyId: 1, taxRateId: 2, isActive: true, customFields: {},
      tracking: TRACKING_SERIALIZED, materialId: 3, colorId: 4, finishId: 5,
      thicknessMm: 20, originCountryId: 7, barcode: 'BC1', defaultWarehouseId: 8,
      kits: [{ id: 'k1', name: 'Kitchen' }],
      createdAt: '2026-01-01', updatedAt: '2026-01-02',
    }
    const payload = toItemPayload(fromItem(item, [warehouseWithNumericId]), [warehouseWithNumericId])
    expect(payload).toEqual({
      sku: 'SKU', name: 'Name', description: 'Desc', unitId: 6, unitPrice: 10,
      purchaseUnitPrice: 7, currencyId: 1, taxRateId: 2, customFields: {}, tracking: TRACKING_SERIALIZED,
      materialId: 3, colorId: 4, finishId: 5, thicknessMm: 20, originCountryId: 7,
      barcode: 'BC1', defaultWarehouseId: 8, trackStock: true, kitIds: ['k1'],
    })
  })

  it('loads an item without kits as an empty list', () => {
    const item: InventoryItem = {
      id: 'uuid-1', sku: 'SKU', name: 'Name', description: '', unitId: 6, unitPrice: 10,
      isActive: true, customFields: {}, tracking: TRACKING_QUANTITY, thicknessMm: 0,
      barcode: '', createdAt: '2026-01-01', updatedAt: '2026-01-02',
    }
    expect(fromItem(item, []).kits).toEqual([])
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
  it('defaults to quantity tracking, a zeroed thickness and both prices blank', () => {
    const d = itemDefaults()
    expect(d.tracking).toBe(TRACKING_QUANTITY)
    // Blank, not '0': a required price must be decided, not left at a default.
    expect(d.unit_price).toBe('')
    expect(d.purchase_unit_price).toBe('')
    expect(d.thickness_mm).toBe('0')
    expect(d.is_active).toBe(true)
    expect(d.kits).toEqual([])
  })
})

describe('the two prices', () => {
  const base: InventoryItem = {
    id: 'u', sku: 'S', name: 'N', description: '', unitId: 1, unitPrice: 120, isActive: true, customFields: {},
    tracking: TRACKING_QUANTITY, thicknessMm: 0, barcode: '', createdAt: 'a', updatedAt: 'b',
  }

  it('loads each price into its own field', () => {
    const form = fromItem({ ...base, purchaseUnitPrice: 80 })
    expect(form.unit_price).toBe('120')
    expect(form.purchase_unit_price).toBe('80')
  })

  it('loads a purchasing price of 0 as 0, not as the selling price', () => {
    expect(fromItem({ ...base, purchaseUnitPrice: 0 }).purchase_unit_price).toBe('0')
  })

  it('loads an item from an API that predates the purchasing price with the selling price', () => {
    expect(fromItem(base).purchase_unit_price).toBe('120')
  })

  it('sends both prices, as numbers', () => {
    const payload = toItemPayload({ sku: 'x', name: 'y', unit_id: '1', unit_price: '9.5', purchase_unit_price: '4' })
    expect(payload.unitPrice).toBe(9.5)
    expect(payload.purchaseUnitPrice).toBe(4)
  })
})

describe('validateItem', () => {
  const filled = { sku: 'x', name: 'y', unit_id: '1', unit_price: '10', purchase_unit_price: '6' }

  it('requires sku, name, unit and both prices', () => {
    const errors = validateItem({})
    expect(errors.map((e) => e.key)).toEqual(['sku', 'name', 'unit_id', 'unit_price', 'purchase_unit_price'])
  })

  it('passes once all of them are present', () => {
    expect(validateItem(filled)).toEqual([])
  })

  it('treats whitespace-only sku/name as missing', () => {
    const errors = validateItem({ ...filled, sku: '   ', name: '  ' })
    expect(errors.map((e) => e.key)).toEqual(['sku', 'name'])
  })

  it('names each missing price by its own label', () => {
    expect(validateItem({ ...filled, unit_price: '' })).toEqual([{ key: 'unit_price', label: 'Selling Unit Price' }])
    expect(validateItem({ ...filled, purchase_unit_price: '' })).toEqual([
      { key: 'purchase_unit_price', label: 'Purchasing Unit Price' },
    ])
  })

  it('accepts 0 as a price (a service or labour item) but not a blank or a negative', () => {
    expect(validateItem({ ...filled, unit_price: '0', purchase_unit_price: '0' })).toEqual([])
    expect(validateItem({ ...filled, unit_price: '-1' }).map((e) => e.key)).toEqual(['unit_price'])
    expect(validateItem({ ...filled, purchase_unit_price: '   ' }).map((e) => e.key)).toEqual(['purchase_unit_price'])
  })

  it('rejects text that is not a number', () => {
    expect(validateItem({ ...filled, unit_price: 'abc' }).map((e) => e.key)).toEqual(['unit_price'])
  })
})
