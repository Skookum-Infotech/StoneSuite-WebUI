import { describe, it, expect } from 'vitest'
import {
  mergeReceiptLines, includedReceiptLines, validateReceiptLines, validateReceiptLineErrors,
  toCreatePayload, toUpdatePayload, fromItemReceipt, irStatusLabel,
  isPurchaseOrderReceivable, RECEIVABLE_PO_STATUS_CODES, IR_STATUS_COLORS,
  receivingQty, isSerializedLine, validateReceiptHeader, exceedsOverReceiptTolerance,
  type ItemReceiptDraftLine,
} from './itemReceiptForm'
import { newDraftSlab } from './itemReceiptSlabs'
import { PO_STATUS_CODES } from './purchaseOrderForm'
import type { PurchaseOrderLine } from '@/types/purchaseOrder'
import type { ItemReceipt, ItemReceiptLine, OnOrderSlab } from '@/types/itemReceipt'

function poLine(overrides: Partial<PurchaseOrderLine> = {}): PurchaseOrderLine {
  return {
    id: 'poi-1', lineNumber: 1, sku: 'SKU-1', itemName: 'Widget', description: 'A widget',
    unitCode: 'EA', quantity: 100, qtyReceived: 0, qtyBilled: 0, unitPrice: 5, discountPercent: 0,
    taxPercent: 0, lineSubtotal: 500, lineDiscount: 0, lineTax: 0, lineTotal: 500,
    inventoryItemId: 'inv-1',
    ...overrides,
  }
}

function irLine(overrides: Partial<ItemReceiptLine> = {}): ItemReceiptLine {
  return {
    id: 'irl-1', lineNumber: 1, purchaseOrderItemId: 'poi-1', sku: 'SKU-1',
    itemName: 'Widget', description: 'A widget', unitCode: 'EA',
    qtyReceived: 20, qtyRejected: 0, qtyOrdered: 100, qtyReceivedToDate: 0,
    ...overrides,
  }
}

describe('mergeReceiptLines', () => {
  it('defaults qtyReceived to the outstanding quantity when there is no existing line (Receive)', () => {
    const [line] = mergeReceiptLines([poLine({ quantity: 100, qtyReceived: 40 })])
    expect(line.qtyOrdered).toBe(100)
    expect(line.qtyAlreadyReceived).toBe(40)
    expect(line.qtyReceived).toBe('60')
    expect(line.qtyRejected).toBe('0')
  })

  it('leaves qtyReceived blank for a fully-received line so it is excluded by default', () => {
    const [line] = mergeReceiptLines([poLine({ quantity: 100, qtyReceived: 100 })])
    expect(line.qtyReceived).toBe('')
  })

  it('never reports negative outstanding for an already over-received line', () => {
    const [line] = mergeReceiptLines([poLine({ quantity: 100, qtyReceived: 120 })])
    expect(line.qtyReceived).toBe('')
    expect(line.qtyAlreadyReceived).toBe(120)
  })

  it('overlays an existing receipt line\'s own saved values (Edit) instead of the outstanding default', () => {
    const [line] = mergeReceiptLines(
      [poLine({ quantity: 100, qtyReceived: 40 })],
      [irLine({ qtyReceived: 25, qtyRejected: 5, lineNotes: 'partial pallet' })],
    )
    expect(line.qtyReceived).toBe('25')
    expect(line.qtyRejected).toBe('5')
    expect(line.lineNotes).toBe('partial pallet')
  })

  it('matches existing lines to PO lines by purchaseOrderItemId, not array position', () => {
    const lines = mergeReceiptLines(
      [poLine({ id: 'poi-1' }), poLine({ id: 'poi-2', sku: 'SKU-2' })],
      [irLine({ purchaseOrderItemId: 'poi-2', qtyReceived: 9 })],
    )
    expect(lines[0].qtyReceived).not.toBe('9')
    expect(lines[1].qtyReceived).toBe('9')
  })
})

describe('includedReceiptLines / validateReceiptLines', () => {
  const base: ItemReceiptDraftLine = {
    purchaseOrderItemId: 'poi-1', lineNumber: 1, itemName: 'Widget', sku: 'SKU-1',
    description: '', unitCode: 'EA', qtyOrdered: 100, qtyAlreadyReceived: 0,
    qtyReceived: '', qtyRejected: '0', lineNotes: '',
    tracking: '', slabs: [],
  }

  it('excludes lines with a blank or zero qtyReceived', () => {
    const lines = [base, { ...base, purchaseOrderItemId: 'poi-2', qtyReceived: '0' }]
    expect(includedReceiptLines(lines)).toHaveLength(0)
  })

  it('requires at least one included line', () => {
    expect(validateReceiptLines([base])).toContain('At least one line item is required.')
  })

  it('rejects a negative qtyRejected on an included line', () => {
    const lines = [{ ...base, qtyReceived: '10', qtyRejected: '-1' }]
    expect(validateReceiptLines(lines)).toEqual(['Line 1: rejected quantity cannot be negative.'])
  })

  it('rejects qtyRejected greater than qtyReceived', () => {
    const lines = [{ ...base, qtyReceived: '10', qtyRejected: '11' }]
    expect(validateReceiptLines(lines)).toEqual(['Line 1: rejected quantity cannot exceed the received quantity.'])
  })

  it('passes for a valid included line', () => {
    const lines = [{ ...base, qtyReceived: '10', qtyRejected: '2' }]
    expect(validateReceiptLines(lines)).toEqual([])
  })
})

describe('validateReceiptLineErrors', () => {
  const base: ItemReceiptDraftLine = {
    purchaseOrderItemId: 'poi-1', lineNumber: 3, itemName: 'Widget', sku: 'SKU-1',
    description: '', unitCode: 'EA', qtyOrdered: 100, qtyAlreadyReceived: 0,
    qtyReceived: '', qtyRejected: '0', lineNotes: '',
    tracking: '', slabs: [],
  }

  it('keys each error back to the offending line\'s purchaseOrderItemId, not just its number', () => {
    const lines = [{ ...base, qtyReceived: '10', qtyRejected: '11' }]
    expect(validateReceiptLineErrors(lines)).toEqual([
      { purchaseOrderItemId: 'poi-1', lineNumber: 3, message: 'rejected quantity cannot exceed the received quantity.' },
    ])
  })

  it('has no "at least one line" entry — that check has no single row to attach to', () => {
    expect(validateReceiptLineErrors([base])).toEqual([])
  })

  it('is empty for a valid included line', () => {
    expect(validateReceiptLineErrors([{ ...base, qtyReceived: '10', qtyRejected: '2' }])).toEqual([])
  })
})

describe('toCreatePayload / toUpdatePayload', () => {
  const data = {
    receipt_date: '2026-07-24', packing_slip: 'PS-1', carrier: 'FedEx',
    tracking_number: 'TRK-1', bill_of_lading: 'BOL-1', owner_employee: '7',
    notes: 'n', internal_notes: 'in',
  }
  const lines: ItemReceiptDraftLine[] = [
    { purchaseOrderItemId: 'poi-1', lineNumber: 1, itemName: 'Widget', sku: 'SKU-1',
      description: '', unitCode: 'EA', qtyOrdered: 100, qtyAlreadyReceived: 0,
      qtyReceived: '10', qtyRejected: '1', lineNotes: 'ok', tracking: '', slabs: [] },
    { purchaseOrderItemId: 'poi-2', lineNumber: 2, itemName: 'Gadget', sku: 'SKU-2',
      description: '', unitCode: 'EA', qtyOrdered: 5, qtyAlreadyReceived: 5,
      qtyReceived: '', qtyRejected: '0', lineNotes: '', tracking: '', slabs: [] },
  ]

  it('only sends included lines, renumbered sequentially', () => {
    const payload = toCreatePayload('po-uuid-1', data, lines, { color: 'red' })
    expect(payload.purchaseOrderUuid).toBe('po-uuid-1')
    expect(payload.items).toEqual([
      { lineNumber: 1, purchaseOrderItemUuid: 'poi-1', qtyReceived: 10, qtyRejected: 1, lineNotes: 'ok' },
    ])
    expect(payload.ownerEmployeeId).toBe(7)
    expect(payload.customFields).toEqual({ color: 'red' })
  })

  it('update payload mirrors create minus the purchase order', () => {
    const payload = toUpdatePayload(data, lines)
    expect(payload).not.toHaveProperty('purchaseOrderUuid')
    expect(payload.packingSlip).toBe('PS-1')
  })
})

describe('fromItemReceipt', () => {
  it('round-trips header fields into UI form-state keys', () => {
    const ir: ItemReceipt = {
      id: 'ir-1', itemReceiptNumber: 'IRCT-000001', status: 'Pending', statusCode: 'PEND',
      purchaseOrder: { id: 'po-1' }, vendor: { id: 'v-1', name: 'Acme' },
      warehouseId: 1, warehouseName: 'Main', receiptDate: '2026-07-24',
      packingSlip: 'PS-1', ownerEmployeeId: 7,
      createdAt: '2026-07-24T00:00:00Z', updatedAt: '2026-07-24T00:00:00Z',
      customFields: { color: 'blue' },
    }
    const { data, customFieldValues } = fromItemReceipt(ir)
    // The location picker is filled from the lookups (by numeric id), not from the receipt.
    expect(data).not.toHaveProperty('warehouse_id')
    expect(data.packing_slip).toBe('PS-1')
    expect(data.owner_employee).toBe('7')
    expect(customFieldValues).toEqual({ color: 'blue' })
  })
})

describe('irStatusLabel', () => {
  it.each([
    ['PEND', 'Pending'],
    ['PART', 'Partial'],
    ['RCVD', 'Received'],
    ['VOID', 'Void'],
  ])('label(%p) -> %p', (code, expected) => {
    expect(irStatusLabel(code)).toBe(expected)
  })
  it('falls back to the raw code for an unrecognized status', () => {
    expect(irStatusLabel('ZZZZ')).toBe('ZZZZ')
  })
})

describe('IR_STATUS_COLORS', () => {
  it('is a distinct map from the PO status colors (spec §5)', () => {
    expect(Object.keys(IR_STATUS_COLORS).sort()).toEqual(['PART', 'PEND', 'RCVD', 'VOID'])
  })
})

describe('RECEIVABLE_PO_STATUS_CODES', () => {
  // The picker filters server-side on this list, so it must agree with the
  // per-order check above and with itemreceipt/store.go receivableStatusCodes.
  it('is exactly SENT and PART', () => {
    expect([...RECEIVABLE_PO_STATUS_CODES].sort()).toEqual(['PART', 'SENT'])
  })

  it('agrees with isPurchaseOrderReceivable for every PO status', () => {
    for (const { code } of PO_STATUS_CODES) {
      expect(isPurchaseOrderReceivable({ statusCode: code as never })).toBe(RECEIVABLE_PO_STATUS_CODES.includes(code))
    }
  })
})

describe('isPurchaseOrderReceivable', () => {
  it.each([
    ['SENT', true],
    ['PART', true],
    ['DRFT', false],
    ['RCVD', false],
    ['CLSD', false],
    ['CANC', false],
  ])('statusCode(%p) -> %p', (statusCode, expected) => {
    expect(isPurchaseOrderReceivable({ statusCode: statusCode as never })).toBe(expected)
  })
})

// ── Slab lines (serialized items) ────────────────────────────────────────────

// 3048 x 1524 mm is exactly 10 ft x 5 ft = 50 sq ft.
const fullSlab = () => newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30' })

function slabLine(overrides: Partial<ItemReceiptDraftLine> = {}): ItemReceiptDraftLine {
  return {
    purchaseOrderItemId: 'poi-s', lineNumber: 2, itemName: 'Absolute Black', sku: 'AB-30',
    description: '', unitCode: 'SQFT', qtyOrdered: 500, qtyAlreadyReceived: 0,
    qtyReceived: '', qtyRejected: '0', lineNotes: '',
    tracking: 'serialized', slabs: [],
    ...overrides,
  }
}

describe('mergeReceiptLines — slab lines', () => {
  it('does not default a quantity: the receiver adds slabs instead', () => {
    const [line] = mergeReceiptLines([poLine({ tracking: 'serialized', unitCode: 'SQFT', quantity: 500 })])
    expect(line.tracking).toBe('serialized')
    expect(line.qtyReceived).toBe('')
    expect(line.slabs).toEqual([])
  })

  it('rebuilds editable slab rows from a saved receipt line (Edit)', () => {
    const [line] = mergeReceiptLines(
      [poLine({ tracking: 'serialized', unitCode: 'SQFT' })],
      [irLine({
        qtyReceived: 50,
        slabs: [{ lengthMm: 3048, widthMm: 1524, thicknessMm: 30, area: 50, binId: 'bin-1', lot: 'L1' }],
      })],
    )
    expect(line.slabs).toHaveLength(1)
    expect(line.slabs[0]).toMatchObject({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30', binId: 'bin-1', lot: 'L1' })
    expect(line.qtyRejected).toBe('0')
  })

  it.each([
    ['inches', 'in', 120, 60, 3048, 1524],
    ['millimetres', 'mm', 3048, 1524, 3048, 1524],
    ['a blank unit, read as inches', null, 120, 60, 3048, 1524],
  ])('carries the ordered slab size in millimetres, measured in %s', (_name, unit, length, width, wantL, wantW) => {
    const [line] = mergeReceiptLines([poLine({ tracking: 'serialized', length, width, dimensionUnit: unit })])
    expect(line.defaultLengthMm).toBe(wantL)
    expect(line.defaultWidthMm).toBe(wantW)
  })

  it('carries no slab size when the order line did not state one', () => {
    const [line] = mergeReceiptLines([poLine({ tracking: 'serialized', length: null, width: null })])
    expect(line.defaultLengthMm).toBeUndefined()
    expect(line.defaultWidthMm).toBeUndefined()
  })

  it('leaves a quantity line exactly as before', () => {
    const [line] = mergeReceiptLines([poLine({ tracking: 'quantity', quantity: 100 })])
    expect(line.tracking).toBe('quantity')
    expect(line.qtyReceived).toBe('100')
    expect(line.slabs).toEqual([])
  })

  it('treats a free-text line (no tracking) as a quantity line', () => {
    const [line] = mergeReceiptLines([poLine({ tracking: undefined })])
    expect(line.tracking).toBe('')
    expect(isSerializedLine(line)).toBe(false)
  })
})

describe('receivingQty / includedReceiptLines — slab lines', () => {
  it('a slab line receives the sum of its slabs', () => {
    expect(receivingQty(slabLine({ slabs: [fullSlab(), fullSlab()] }))).toBeCloseTo(100, 3)
  })

  it('ignores a stray typed quantity on a slab line', () => {
    expect(receivingQty(slabLine({ qtyReceived: '999', slabs: [fullSlab()] }))).toBeCloseTo(50, 3)
  })

  it('a quantity line still receives what was typed', () => {
    expect(receivingQty(slabLine({ tracking: 'quantity', qtyReceived: '12' }))).toBe(12)
  })

  it('a slab line with no slabs is skipped, like a blank quantity', () => {
    expect(includedReceiptLines([slabLine()])).toHaveLength(0)
  })

  it('a slab line with any slab row is included, even an unfinished one, so it gets validated', () => {
    expect(includedReceiptLines([slabLine({ slabs: [newDraftSlab()] })])).toHaveLength(1)
  })
})

describe('validateReceiptLineErrors — slab lines', () => {
  it('passes for complete slabs', () => {
    expect(validateReceiptLines([slabLine({ slabs: [fullSlab()] })])).toEqual([])
  })

  it('flags each unfinished slab by its position, keyed to the PO line', () => {
    const lines = [slabLine({ slabs: [fullSlab(), newDraftSlab({ lengthMm: '3048' })] })]
    expect(validateReceiptLineErrors(lines)).toEqual([
      {
        purchaseOrderItemId: 'poi-s', lineNumber: 2,
        message: 'slab 2: width and thickness must be greater than zero.',
      },
    ])
  })

  it('never applies the rejected-quantity rules to a slab line', () => {
    expect(validateReceiptLineErrors([slabLine({ qtyRejected: '-5', slabs: [fullSlab()] })])).toEqual([])
  })

  it('still requires a line when the only slab line has no slabs', () => {
    expect(validateReceiptLines([slabLine()])).toContain('At least one line item is required.')
  })
})

describe('validateReceiptHeader', () => {
  it('requires a location', () => {
    expect(validateReceiptHeader({})).toEqual(['A location is required.'])
    expect(validateReceiptHeader({ warehouse_id: '  ' })).toEqual(['A location is required.'])
  })

  it('passes once one is chosen', () => {
    expect(validateReceiptHeader({ warehouse_id: 'wh-uuid' })).toEqual([])
  })
})

describe('payload mapping — slab lines and warehouse', () => {
  const data = { receipt_date: '2026-09-29', warehouse_id: 'wh-uuid' }

  it('sends a slab line as slabs, with the computed quantity and no rejected quantity', () => {
    const line = slabLine({
      slabs: [
        newDraftSlab({ lengthMm: '3048', widthMm: '1524', thicknessMm: '30', binId: 'bin-1', lot: ' L1 ' }),
        fullSlab(),
      ],
      lineNotes: ' two on the truck ',
    })
    const payload = toCreatePayload('po-1', data, [line])
    expect(payload.items).toHaveLength(1)
    const [item] = payload.items
    expect(item.purchaseOrderItemUuid).toBe('poi-s')
    expect(item.qtyReceived).toBeCloseTo(100, 3)
    expect(item).not.toHaveProperty('qtyRejected')
    expect(item.lineNotes).toBe('two on the truck')
    expect(item.slabs).toHaveLength(2)
    expect(item.slabs?.[0]).toMatchObject({ lengthMm: 3048, widthMm: 1524, thicknessMm: 30, binId: 'bin-1', lot: 'L1' })
    // Neither a serial nor an area is ever sent.
    expect(item.slabs?.[0]).not.toHaveProperty('serial')
    expect(item.slabs?.[0]).not.toHaveProperty('area')
  })

  it('a quantity line carries no slabs key', () => {
    const payload = toCreatePayload('po-1', data, [slabLine({ tracking: '', qtyReceived: '4' })])
    expect(payload.items[0]).not.toHaveProperty('slabs')
    expect(payload.items[0]).toMatchObject({ qtyReceived: 4, qtyRejected: 0 })
  })

  it('passes the numeric warehouse id, and the post options, through', () => {
    const payload = toCreatePayload('po-1', data, [slabLine({ slabs: [fullSlab()] })], {}, {
      warehouseId: 7, post: true, overReceiptReason: 'extra pallet',
    })
    expect(payload).toMatchObject({ warehouseId: 7, post: true, overReceiptReason: 'extra pallet' })
  })

  it.each([[undefined], [null], [0]])('omits the warehouse id when it is %s', (warehouseId) => {
    const payload = toCreatePayload('po-1', data, [slabLine({ slabs: [fullSlab()] })], {}, { warehouseId })
    expect(payload.warehouseId).toBeUndefined()
  })

  it('the update payload carries the warehouse id too', () => {
    const payload = toUpdatePayload(data, [slabLine({ slabs: [fullSlab()] })], {}, 9)
    expect(payload.warehouseId).toBe(9)
  })
})

describe('mergeReceiptLines — measuring unit', () => {
  it('carries the unit the item is measured in, so slab sizes show in it from the start', () => {
    const [line] = mergeReceiptLines([poLine({ tracking: 'serialized', unitCode: 'SQFT', dimensionUnit: 'in' })])
    expect(line.dimensionUnit).toBe('in')
  })

  it('has none when the order line states none', () => {
    const [line] = mergeReceiptLines([poLine({ tracking: 'serialized', unitCode: 'SQFT' })])
    expect(line.dimensionUnit).toBeUndefined()
  })
})

describe('mergeReceiptLines — expected slabs', () => {
  it('carries the order line\'s expected count and earlier progress onto a slab line', () => {
    const [line] = mergeReceiptLines([poLine({ tracking: 'serialized', unitCode: 'SQFT', expectedSlabs: 12, slabsReceived: 8 })])
    expect(line.expectedSlabs).toBe(12)
    expect(line.slabsReceived).toBe(8)
  })

  it('defaults to no expectation and nothing received', () => {
    const [line] = mergeReceiptLines([poLine({ tracking: 'serialized', unitCode: 'SQFT' })])
    expect(line.expectedSlabs).toBeNull()
    expect(line.slabsReceived).toBe(0)
  })

  it('ignores a slab count on a line that is not a slab line', () => {
    const [line] = mergeReceiptLines([poLine({ tracking: 'quantity', expectedSlabs: 12, slabsReceived: 8 })])
    expect(line.expectedSlabs).toBeNull()
    expect(line.slabsReceived).toBe(0)
  })

})

describe('exceedsOverReceiptTolerance', () => {
  // Mirrors itemreceipt.WithinTolerance: 5% over the ordered quantity is accepted without a reason.
  const qty = (over: Partial<ItemReceiptDraftLine>) => slabLine({ tracking: 'quantity', slabs: [], qtyOrdered: 100, qtyAlreadyReceived: 0, qtyReceived: '', ...over })

  it('is quiet for the odd thousandth that area rounding adds', () => {
    expect(exceedsOverReceiptTolerance(qty({ qtyOrdered: 173.333, qtyReceived: '173.334' }))).toBe(false)
  })

  it('accepts up to 5% over and flags anything past it', () => {
    expect(exceedsOverReceiptTolerance(qty({ qtyReceived: '105' }))).toBe(false)
    expect(exceedsOverReceiptTolerance(qty({ qtyReceived: '105.01' }))).toBe(true)
  })

  it('counts what earlier receipts already brought in', () => {
    expect(exceedsOverReceiptTolerance(qty({ qtyAlreadyReceived: 60, qtyReceived: '45' }))).toBe(false)
    expect(exceedsOverReceiptTolerance(qty({ qtyAlreadyReceived: 60, qtyReceived: '46' }))).toBe(true)
  })

  it('is quiet when nothing is being received', () => {
    expect(exceedsOverReceiptTolerance(qty({ qtyReceived: '' }))).toBe(false)
  })

  it('flags anything received against a line that ordered nothing', () => {
    expect(exceedsOverReceiptTolerance(qty({ qtyOrdered: 0, qtyReceived: '1' }))).toBe(true)
  })
})

// ── Slabs the order put on order (ticked off on the receipt) ─────────────────

describe('on-order slabs — receiving by ticking', () => {
  const onOrder = (id: string, over: Partial<OnOrderSlab> = {}): OnOrderSlab => ({
    id, serial: `PO-000001-${id}`, purchaseOrderItemId: 'poi-s',
    lengthMm: 3048, widthMm: 1524, thicknessMm: 30, area: 50, ...over,
  })
  const slabPoLine = () => poLine({ id: 'poi-s', tracking: 'serialized', unitCode: 'SQFT', quantity: 150 })
  const tick = (line: ItemReceiptDraftLine, ...ids: string[]): ItemReceiptDraftLine => ({
    ...line, onOrder: (line.onOrder ?? []).map((d) => (ids.includes(d.id) ? { ...d, arrived: true } : d)),
  })

  it('lists the order\'s slabs under their line, none ticked', () => {
    const [line] = mergeReceiptLines([slabPoLine()], [], [onOrder('001'), onOrder('002'), onOrder('x', { purchaseOrderItemId: 'other' })])

    expect(line.onOrder?.map((d) => d.id)).toEqual(['001', '002'])
    expect(line.onOrder?.every((d) => !d.arrived)).toBe(true)
    expect(line.onOrder?.every((d) => d.binId === '')).toBe(true)
  })

  it('gives a quantity line, and a line with nothing on order, no checklist', () => {
    expect(mergeReceiptLines([poLine()], [], [onOrder('001', { purchaseOrderItemId: 'poi-1' })])[0].onOrder).toEqual([])
    expect(mergeReceiptLines([slabPoLine()])[0].onOrder).toEqual([])
  })

  it('brings a pending receipt\'s ticked slabs back ticked, and out of the typed rows', () => {
    const [line] = mergeReceiptLines(
      [slabPoLine()],
      [irLine({
        id: 'irl-s', purchaseOrderItemId: 'poi-s', unitCode: 'SQFT',
        slabs: [
          { onOrderSlabId: '002', lengthMm: 3048, widthMm: 1524, thicknessMm: 30, area: 50, binId: 'bin-9' },
          { lengthMm: 3048, widthMm: 1524, thicknessMm: 30, area: 50 },
        ],
      })],
      [onOrder('001'), onOrder('002')],
    )

    expect(line.onOrder?.map((d) => d.arrived)).toEqual([false, true])
    expect(line.onOrder?.map((d) => d.binId)).toEqual(['', 'bin-9'])
    expect(line.slabs).toHaveLength(1) // only the one the receiver typed
  })

  it('receives the area of the ticked slabs only', () => {
    const [line] = mergeReceiptLines([slabPoLine()], [], [onOrder('001'), onOrder('002'), onOrder('003')])

    expect(receivingQty(line)).toBe(0)
    expect(receivingQty(tick(line, '001', '003'))).toBeCloseTo(100, 3)
  })

  it('adds ticked slabs to any typed in', () => {
    const [line] = mergeReceiptLines([slabPoLine()], [], [onOrder('001')])
    expect(receivingQty({ ...tick(line, '001'), slabs: [fullSlab()] })).toBeCloseTo(100, 3)
  })

  it('includes a slab line once a slab is ticked, and skips it before that', () => {
    const [line] = mergeReceiptLines([slabPoLine()], [], [onOrder('001')])

    expect(includedReceiptLines([line])).toHaveLength(0)
    expect(includedReceiptLines([tick(line, '001')])).toHaveLength(1)
    expect(validateReceiptLines([line])).toEqual(['At least one line item is required.'])
    expect(validateReceiptLines([tick(line, '001')])).toEqual([])
  })

  it('asks for a thickness only on a ticked slab the order left it out of', () => {
    const [line] = mergeReceiptLines([slabPoLine()], [], [onOrder('001', { thicknessMm: 0 }), onOrder('002', { thicknessMm: 0 })])

    expect(validateReceiptLineErrors([line])).toEqual([])
    expect(validateReceiptLineErrors([tick(line, '001')])).toEqual([
      { purchaseOrderItemId: 'poi-s', lineNumber: 1, message: 'slab PO-000001-001: thickness must be greater than zero.' },
    ])
    const typed = { ...tick(line, '001'), onOrder: tick(line, '001').onOrder?.map((d) => (d.id === '001' ? { ...d, thicknessMm: '25' } : d)) }
    expect(validateReceiptLineErrors([typed])).toEqual([])
  })

  it('sends a ticked slab by id with the line\'s bin, ahead of any typed slab', () => {
    const [line] = mergeReceiptLines([slabPoLine()], [], [onOrder('001'), onOrder('002')])
    const onOrderWithBin = tick(line, '002').onOrder?.map((d) => (d.id === '002' ? { ...d, binId: 'bin-3' } : d))
    const ticked = { ...line, onOrder: onOrderWithBin, slabs: [fullSlab()] }

    const payload = toCreatePayload('po-1', { receipt_date: '2026-10-30', warehouse_id: 'wh' }, [ticked])
    const [item] = payload.items

    expect(item.qtyReceived).toBeCloseTo(100, 3)
    expect(item.slabs).toHaveLength(2)
    expect(item.slabs?.[0]).toEqual({
      onOrderSlabId: '002', lengthMm: 3048, widthMm: 1524, thicknessMm: 30, binId: 'bin-3',
    })
    expect(item.slabs?.[1]).not.toHaveProperty('onOrderSlabId')
  })

  it('counts ticked slabs toward the over-receipt check', () => {
    const [line] = mergeReceiptLines([poLine({ id: 'poi-s', tracking: 'serialized', unitCode: 'SQFT', quantity: 60 })], [], [onOrder('001'), onOrder('002')])

    expect(exceedsOverReceiptTolerance(tick(line, '001'))).toBe(false)
    expect(exceedsOverReceiptTolerance(tick(line, '001', '002'))).toBe(true)
  })
})
