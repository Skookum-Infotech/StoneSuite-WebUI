import { describe, it, expect } from 'vitest'
import {
  mergeReceiptLines, includedReceiptLines, validateReceiptLines,
  toCreatePayload, toUpdatePayload, fromItemReceipt, irStatusLabel,
  isPurchaseOrderReceivable, IR_STATUS_COLORS,
  type ItemReceiptDraftLine,
} from './itemReceiptForm'
import type { PurchaseOrderLine } from '@/types/purchaseOrder'
import type { ItemReceipt, ItemReceiptLine } from '@/types/itemReceipt'

function poLine(overrides: Partial<PurchaseOrderLine> = {}): PurchaseOrderLine {
  return {
    id: 'poi-1', lineNumber: 1, sku: 'SKU-1', itemName: 'Widget', description: 'A widget',
    unitCode: 'EA', quantity: 100, qtyReceived: 0, unitPrice: 5, discountPercent: 0,
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

describe('toCreatePayload / toUpdatePayload', () => {
  const data = {
    receipt_date: '2026-07-24', packing_slip: 'PS-1', carrier: 'FedEx',
    tracking_number: 'TRK-1', bill_of_lading: 'BOL-1', owner_employee: '7',
    notes: 'n', internal_notes: 'in',
  }
  const lines: ItemReceiptDraftLine[] = [
    { purchaseOrderItemId: 'poi-1', lineNumber: 1, itemName: 'Widget', sku: 'SKU-1',
      description: '', unitCode: 'EA', qtyOrdered: 100, qtyAlreadyReceived: 0,
      qtyReceived: '10', qtyRejected: '1', lineNotes: 'ok' },
    { purchaseOrderItemId: 'poi-2', lineNumber: 2, itemName: 'Gadget', sku: 'SKU-2',
      description: '', unitCode: 'EA', qtyOrdered: 5, qtyAlreadyReceived: 5,
      qtyReceived: '', qtyRejected: '0', lineNotes: '' },
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
    expect(data.warehouse_name).toBe('Main')
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
