import { describe, it, expect } from 'vitest'
import {
  PO_ALLOWED_TRANSITIONS, isPoTransitionBlocked, poTransitionLabel, poStatusLabel,
  poNextCodes, poHeaderTransitions, poDropdownTransitions,
  billableQuantity, poBillableLines, PO_BILLABLE_STATUSES,
  calcLineItem, calcHeaderTotals, toCreatePayload, validatePurchaseOrderCustomFields, fromPurchaseOrder,
} from './purchaseOrderForm'
import type { FieldDefinition } from '@/types/tenant'
import type { PurchaseOrder } from '@/types/purchaseOrder'

describe('PO_ALLOWED_TRANSITIONS', () => {
  it.each([
    ['DRFT', ['PAPV', 'CANC']],
    ['PAPV', ['APPV', 'DRFT', 'CANC']],
    ['APPV', ['SENT', 'DRFT', 'CANC']],
    ['SENT', ['PART', 'RCVD', 'CLSD', 'CANC']],
    ['PART', ['RCVD', 'CLSD']],
    ['RCVD', ['CLSD']],
    ['CLSD', []],
    ['CANC', []],
  ])('from(%p) -> %p', (code, expected) => {
    expect(PO_ALLOWED_TRANSITIONS[code]).toEqual(expected)
  })
})

// The header buttons (Submit for Approval, Send to Vendor) and the super-admin
// dropdown split a record's legal next-moves between them: together they must
// cover every move exactly once.
describe('poNextCodes / poHeaderTransitions / poDropdownTransitions', () => {
  it.each([
    // [label, order, next, header buttons, dropdown options]
    ['draft, approvers configured (static map)', { statusCode: 'DRFT' }, ['PAPV', 'CANC'], ['PAPV'], ['CANC']],
    ['draft, nobody to approve (backend collapsed the checkpoint)', { statusCode: 'DRFT', nextStatusCodes: ['CANC', 'SENT'] }, ['CANC', 'SENT'], ['SENT'], ['CANC']],
    ['pending approval', { statusCode: 'PAPV' }, ['APPV', 'DRFT', 'CANC'], [], ['APPV', 'DRFT', 'CANC']],
    ['approved', { statusCode: 'APPV' }, ['SENT', 'DRFT', 'CANC'], ['SENT'], ['DRFT', 'CANC']],
    ['sent', { statusCode: 'SENT' }, ['PART', 'RCVD', 'CLSD', 'CANC'], [], ['PART', 'RCVD', 'CLSD', 'CANC']],
    ['closed is terminal', { statusCode: 'CLSD' }, [], [], []],
    ['record nextStatusCodes wins over the static map', { statusCode: 'DRFT', nextStatusCodes: [] }, [], [], []],
    ['unknown status has no moves', { statusCode: 'XXXX' }, [], [], []],
  ])('%s', (_label, order, next, header, dropdown) => {
    expect(poNextCodes(order)).toEqual(next)
    expect(poHeaderTransitions(order)).toEqual(header)
    expect(poDropdownTransitions(order)).toEqual(dropdown)
  })

  it('lists Submit for Approval before Send to Vendor when both are legal', () => {
    expect(poHeaderTransitions({ statusCode: 'DRFT', nextStatusCodes: ['SENT', 'PAPV', 'CANC'] })).toEqual(['PAPV', 'SENT'])
  })
})

describe('isPoTransitionBlocked', () => {
  it('blocks a non-DRFT target while approval is pending', () => {
    expect(isPoTransitionBlocked('APPV', 'pending')).toBe(true)
    expect(isPoTransitionBlocked('CANC', 'pending')).toBe(true)
  })
  it('always allows recalling to DRFT, even while pending', () => {
    expect(isPoTransitionBlocked('DRFT', 'pending')).toBe(false)
  })
  it('allows any target once approval is none or approved', () => {
    expect(isPoTransitionBlocked('APPV', 'none')).toBe(false)
    expect(isPoTransitionBlocked('APPV', 'approved')).toBe(false)
  })
})

describe('poTransitionLabel', () => {
  it('distinguishes the same target reached from different sources', () => {
    expect(poTransitionLabel('PAPV', 'DRFT')).toBe('Recall to Draft')
    expect(poTransitionLabel('APPV', 'DRFT')).toBe('Revise')
  })
  it('falls back to the raw code for an unmapped pair', () => {
    expect(poTransitionLabel('DRFT', 'ZZZZ')).toBe('ZZZZ')
  })
})

describe('poStatusLabel', () => {
  it.each([
    ['DRFT', 'Draft'],
    ['PAPV', 'Pending Approval'],
    ['CANC', 'Cancelled'],
  ])('label(%p) -> %p', (code, expected) => {
    expect(poStatusLabel(code)).toBe(expected)
  })
  it('falls back to the raw code for an unrecognized status', () => {
    expect(poStatusLabel('ZZZZ')).toBe('ZZZZ')
  })
})

describe('calcLineItem (mirrors purchaseorder/calc.go ComputeLine)', () => {
  it('rounds subtotal, discount, and tax at each step', () => {
    // sub = round2(3 * 10.005) = round2(30.015) = 30.02
    // discAmt = round2(30.02 * 0.10) = 3.00
    // amount = round2(30.02 - 3.00) = 27.02
    // tax = round2(27.02 * 0.0825) = round2(2.22915) = 2.23
    // total = round2(27.02 + 2.23) = 29.25
    const { amount, total } = calcLineItem(
      { quantity: '3', unitPrice: '10.005', discount: '10' },
      8.25,
    )
    expect(amount).toBe('27.02')
    expect(total).toBe('29.25')
  })

  it('returns empty strings when quantity or price is blank', () => {
    expect(calcLineItem({ quantity: '', unitPrice: '10', discount: '0' }, 0)).toEqual({ amount: '', total: '' })
    expect(calcLineItem({ quantity: '1', unitPrice: '', discount: '0' }, 0)).toEqual({ amount: '', total: '' })
  })
})

describe('calcHeaderTotals (mirrors purchaseorder/calc.go ComputeHeader)', () => {
  it('sums per-line breakdowns and adds shipping + adjustment', () => {
    const lines = [
      { quantity: '3', unitPrice: '10.005', discount: '10' }, // amount 27.02, tax 2.23 (see calcLineItem test)
      { quantity: '2', unitPrice: '5', discount: '0' },        // sub 10.00, disc 0.00, amount 10.00, tax 0.825 -> 0.83
    ]
    const { subtotal, discountAmt, taxTotal, total } = calcHeaderTotals(lines, 8.25, 15, -2)
    expect(subtotal).toBeCloseTo(40.02, 2)
    expect(discountAmt).toBe(3.00)
    expect(taxTotal).toBeCloseTo(2.23 + 0.83, 2)
    expect(total).toBeCloseTo(subtotal - discountAmt + taxTotal + 15 - 2, 2)
  })

  it('returns all zeros for an empty line list', () => {
    expect(calcHeaderTotals([], 0, 0, 0)).toEqual({ subtotal: 0, discountAmt: 0, taxTotal: 0, total: 0 })
  })
})

describe('toCreatePayload line item description mapping', () => {
  const baseData: Record<string, unknown> = { vendor_uuid: 'vnd-1', order_date: '2026-07-23' }

  it('sends no description for a catalog-picked line with no override', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'a', lineNo: 1, itemName: 'Widget', itemDescription: '', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00', inventoryItemUuid: 'inv-1' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, inventoryItemUuid: 'inv-1', quantity: 1, unitPrice: 10, discountPercent: 0 },
    ])
  })

  it('sends an explicit itemDescription for a catalog-picked line, overriding the catalog item', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'b', lineNo: 1, itemName: 'Widget', itemDescription: 'Blue widget, medium', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00', inventoryItemUuid: 'inv-1' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, inventoryItemUuid: 'inv-1', description: 'Blue widget, medium', quantity: 1, unitPrice: 10, discountPercent: 0 },
    ])
  })

  it('falls back to itemName as the description on a free-text line with no explicit description', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'c', lineNo: 1, itemName: 'Custom fasteners', itemDescription: '', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, description: 'Custom fasteners', quantity: 1, unitPrice: 10, discountPercent: 0 },
    ])
  })

  it('prefers an explicit itemDescription over itemName for a free-text line', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'd', lineNo: 1, itemName: 'Custom fasteners', itemDescription: 'Stainless, 1/4in', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, description: 'Stainless, 1/4in', quantity: 1, unitPrice: 10, discountPercent: 0 },
    ])
  })

  it('renumbers lines sequentially from 1 regardless of row order', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'x', lineNo: 5, itemName: 'First', itemDescription: '', quantity: '2', unitPrice: '5', discount: '0', amount: '10.00', total: '10.00' },
      { id: 'y', lineNo: 9, itemName: 'Second', itemDescription: '', quantity: '1', unitPrice: '1', discount: '0', amount: '1.00', total: '1.00' },
    ])
    expect(payload.items.map((i) => i.lineNumber)).toEqual([1, 2])
  })

  it('includes header shipTo, shippingCharge, adjustment, and customFields', () => {
    const payload = toCreatePayload(
      { ...baseData, ship_name: 'Warehouse 3', ship_city: 'Reno', shipping_charge: '12.50', adjustment: '-5' },
      [],
      { budget_code: 'CAP-100' },
    )
    expect(payload.shipTo?.name).toBe('Warehouse 3')
    expect(payload.shipTo?.city).toBe('Reno')
    expect(payload.shippingCharge).toBe(12.5)
    expect(payload.adjustment).toBe(-5)
    expect(payload.customFields).toEqual({ budget_code: 'CAP-100' })
  })
})

describe('validatePurchaseOrderCustomFields', () => {
  const defs: FieldDefinition[] = [
    { id: '1', workflowId: 'wf', key: 'budget_code', label: 'Budget Code', dataType: 'string', required: true, options: [], validation: {}, sortOrder: 0 },
    { id: '2', workflowId: 'wf', key: 'notes', label: 'Notes', dataType: 'string', required: false, options: [], validation: {}, sortOrder: 1 },
  ]

  it('flags a missing required custom field', () => {
    expect(validatePurchaseOrderCustomFields(defs, {})).toEqual([{ key: 'budget_code', label: 'Budget Code' }])
  })

  it('passes when every required field has a value', () => {
    expect(validatePurchaseOrderCustomFields(defs, { budget_code: 'CAP-100' })).toEqual([])
  })

  it('ignores optional fields entirely', () => {
    expect(validatePurchaseOrderCustomFields(defs, { budget_code: 'CAP-100', notes: '' })).toEqual([])
  })
})

// Mirrors vendorbill.billableQuantity / planConversion on the backend, which is
// authoritative -- this only decides whether Create Bill shows and what its
// dialog lists.
describe('billableQuantity', () => {
  it.each([
    ['nothing received', 0, 0, 0],
    ['first delivery, nothing billed', 6, 0, 6],
    ['second delivery bills only the new goods', 10, 6, 4],
    ['fully billed', 10, 10, 0],
    ['receipt voided after billing leaves nothing, not a negative', 4, 6, 0],
    ['fractional quantities', 2.5, 1, 1.5],
    ['float noise is rounded away', 5.1, 2.1, 3],
  ])('%s', (_label, received, billed, want) => {
    expect(billableQuantity(received, billed)).toBe(want)
  })
})

describe('poBillableLines', () => {
  const item = (id: string, lineNumber: number, quantity: number, qtyReceived: number, qtyBilled: number) => ({
    id, lineNumber, itemName: `Item ${lineNumber}`, description: '', quantity, qtyReceived, qtyBilled,
  }) as unknown as Parameters<typeof poBillableLines>[0]['items'][number]

  it.each(['PART', 'RCVD', 'CLSD'])('bills what arrived on a %s order, leaving off lines with nothing received', (statusCode) => {
    const lines = poBillableLines({
      statusCode,
      items: [item('a', 1, 10, 4, 0), item('b', 2, 5, 0, 0), item('c', 3, 8, 8, 0)],
    })
    expect(lines).toEqual([
      { id: 'a', lineNumber: 1, itemName: 'Item 1', ordered: 10, toBill: 4 },
      { id: 'c', lineNumber: 3, itemName: 'Item 3', ordered: 8, toBill: 8 },
    ])
  })

  it('subtracts what earlier bills already cover', () => {
    const lines = poBillableLines({ statusCode: 'PART', items: [item('a', 1, 10, 10, 4)] })
    expect(lines.map((l) => l.toBill)).toEqual([6])
  })

  it('is empty once everything received is billed', () => {
    expect(poBillableLines({ statusCode: 'RCVD', items: [item('a', 1, 10, 10, 10)] })).toEqual([])
  })

  it.each(['DRFT', 'PAPV', 'APPV', 'SENT', 'CANC'])('is empty on a %s order even if quantities are set', (statusCode) => {
    expect(poBillableLines({ statusCode, items: [item('a', 1, 10, 10, 0)] })).toEqual([])
  })

  it('falls back to the description for a free-text line with no item name', () => {
    const line = { ...item('a', 1, 10, 3, 0), itemName: '', description: 'Freight' }
    expect(poBillableLines({ statusCode: 'PART', items: [line] })[0].itemName).toBe('Freight')
  })

  it('agrees with the statuses the backend converts', () => {
    expect([...PO_BILLABLE_STATUSES].sort()).toEqual(['CLSD', 'PART', 'RCVD'])
  })
})

describe('expected slabs on a purchase order line', () => {
  const baseData: Record<string, unknown> = { vendor_uuid: 'vnd-1', order_date: '2026-09-29' }
  const line = (over: Record<string, unknown>) => ({
    id: 'a', lineNo: 1, itemName: 'Absolute Black', itemDescription: '', quantity: '600', unitPrice: '18',
    discount: '0', amount: '10800.00', total: '10800.00', inventoryItemUuid: 'inv-slab', ...over,
  })

  it('sends the count for a slab line', () => {
    const payload = toCreatePayload(baseData, [line({ tracking: 'serialized', expectedSlabs: '12' })])
    expect(payload.items[0].expectedSlabs).toBe(12)
    expect(payload.items[0].quantity).toBe(600)
  })

  it.each([
    ['a blank count', { tracking: 'serialized', expectedSlabs: '' }],
    ['a zero count', { tracking: 'serialized', expectedSlabs: '0' }],
    ['a negative count', { tracking: 'serialized', expectedSlabs: '-4' }],
    ['text', { tracking: 'serialized', expectedSlabs: 'abc' }],
    ['a quantity item that kept a stale count', { tracking: 'quantity', expectedSlabs: '12' }],
    ['a line with no tracking', { expectedSlabs: '12' }],
    ['a free-text line', { tracking: 'serialized', expectedSlabs: '12', inventoryItemUuid: undefined }],
  ])('sends no count for %s', (_name, over) => {
    const payload = toCreatePayload(baseData, [line(over)])
    expect(payload.items[0].expectedSlabs).toBeUndefined()
  })

  it('reads the count and tracking back when a saved order is edited', () => {
    const po = {
      status: 'Draft', purchaseOrderNumber: 'PORD-1', orderDate: '2026-09-29', shipTo: {},
      items: [{
        id: 'l1', lineNumber: 1, sku: 'AB-30', itemName: 'Absolute Black', description: '', unitCode: 'SQFT',
        quantity: 600, qtyReceived: 0, qtyBilled: 0, unitPrice: 18, discountPercent: 0, taxPercent: 0,
        lineSubtotal: 10800, lineDiscount: 0, lineTax: 0, lineTotal: 10800, inventoryItemId: 'inv-slab',
        tracking: 'serialized', expectedSlabs: 12,
      }, {
        id: 'l2', lineNumber: 2, sku: 'S-1', itemName: 'Sealer', description: '', unitCode: 'EA',
        quantity: 3, qtyReceived: 0, qtyBilled: 0, unitPrice: 5, discountPercent: 0, taxPercent: 0,
        lineSubtotal: 15, lineDiscount: 0, lineTax: 0, lineTotal: 15, inventoryItemId: 'inv-each', tracking: 'quantity',
      }],
      vendor: { id: 'v1', name: 'Nero' },
    } as unknown as PurchaseOrder

    const { lineItems } = fromPurchaseOrder(po)

    expect(lineItems[0]).toMatchObject({ tracking: 'serialized', expectedSlabs: '12', units: 'SQFT' })
    expect(lineItems[1]).toMatchObject({ tracking: 'quantity', expectedSlabs: '' })
  })

  it('round-trips a saved slab line back into the same payload', () => {
    const po = {
      status: 'Draft', purchaseOrderNumber: 'PORD-1', orderDate: '2026-09-29', shipTo: {},
      items: [{
        id: 'l1', lineNumber: 1, sku: 'AB-30', itemName: 'Absolute Black', description: '', unitCode: 'SQFT',
        quantity: 600, qtyReceived: 0, qtyBilled: 0, unitPrice: 18, discountPercent: 0, taxPercent: 0,
        lineSubtotal: 10800, lineDiscount: 0, lineTax: 0, lineTotal: 10800, inventoryItemId: 'inv-slab',
        tracking: 'serialized', expectedSlabs: 12,
      }],
      vendor: { id: 'v1', name: 'Nero' },
    } as unknown as PurchaseOrder
    const { lineItems } = fromPurchaseOrder(po)

    const payload = toCreatePayload(baseData, lineItems)

    expect(payload.items[0]).toMatchObject({ inventoryItemUuid: 'inv-slab', quantity: 600, expectedSlabs: 12 })
  })
})
