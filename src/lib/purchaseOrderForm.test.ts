import { describe, it, expect } from 'vitest'
import {
  PO_ALLOWED_TRANSITIONS, isPoTransitionBlocked, poTransitionLabel, poStatusLabel,
  calcLineItem, calcHeaderTotals, toCreatePayload, validatePurchaseOrderCustomFields,
} from './purchaseOrderForm'
import type { FieldDefinition } from '@/types/tenant'

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
