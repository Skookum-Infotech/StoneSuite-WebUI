import { describe, it, expect } from 'vitest'
import { clampPercent, calcLineItem, toCreatePayload, toUpdatePayload, type CreditMemoLineItem } from './creditMemoForm'

// clampPercent guards the discount % input on the Credit Memo items table —
// mirrors invoiceForm.test.ts's coverage since the helper is identical.
describe('clampPercent', () => {
  it.each([
    ['', ''],
    ['50', '50'],
    ['0', '0'],
    ['100', '100'],
    ['-5', '0'],
    ['150', '100'],
    ['-0.5', '0'],
    ['100.5', '100'],
  ])('clampPercent(%p) -> %p', (input, expected) => {
    expect(clampPercent(input)).toBe(expected)
  })

  it('leaves a non-numeric in-progress value untouched', () => {
    expect(clampPercent('-')).toBe('-')
  })
})

describe('calcLineItem', () => {
  it('returns empty amount/total when quantity or price is missing', () => {
    expect(calcLineItem({ quantity: '', unitPrice: '10', discount: '0' }, 0)).toEqual({ amount: '', total: '' })
    expect(calcLineItem({ quantity: '2', unitPrice: '', discount: '0' }, 0)).toEqual({ amount: '', total: '' })
  })

  it('computes amount with discount and total with header tax', () => {
    // qty 2 * price 10 = 20, 10% discount -> 18 amount, 8% header tax -> 19.44 total
    expect(calcLineItem({ quantity: '2', unitPrice: '10', discount: '10' }, 8)).toEqual({
      amount: '18.00',
      total: '19.44',
    })
  })

  it('treats a missing/zero header tax as no tax', () => {
    expect(calcLineItem({ quantity: '1', unitPrice: '100', discount: '0' }, 0)).toEqual({
      amount: '100.00',
      total: '100.00',
    })
  })
})

describe('toCreatePayload', () => {
  const baseData: Record<string, unknown> = {
    customer_uuid: 'cust-1',
    invoice_uuid: 'inv-1',
    sales_order_uuid: 'so-1',
    reference_number: 'REF-1',
    credit_memo_date: '2026-01-01',
    reason: 'Damaged goods',
    sales_tax_pct: '8',
    adjustment: '5',
  }

  const catalogLine: CreditMemoLineItem = {
    id: 'a', lineNo: 1, itemName: 'Widget', itemSku: 'W-1', units: 'ea',
    quantity: '2', unitPrice: '10', discount: '0', amount: '20.00', total: '21.60',
    inventoryItemUuid: 'inv-uuid-1',
  }

  const freeTextLine: CreditMemoLineItem = {
    id: 'b', lineNo: 2, itemName: 'Custom fabrication',
    quantity: '1', unitPrice: '50', discount: '10', amount: '45.00', total: '48.60',
  }

  it('sends inventoryItemUuid and omits description for a catalog line', () => {
    const payload = toCreatePayload(baseData, [catalogLine])
    expect(payload.lines[0]).toEqual({
      lineNumber: 1,
      inventoryItemUuid: 'inv-uuid-1',
      description: undefined,
      quantity: 2,
      unitPrice: 10,
      discountPercent: 0,
    })
  })

  it('sends itemName as description and omits inventoryItemUuid for a free-text line', () => {
    const payload = toCreatePayload(baseData, [freeTextLine])
    expect(payload.lines[0]).toEqual({
      lineNumber: 1,
      inventoryItemUuid: undefined,
      description: 'Custom fabrication',
      quantity: 1,
      unitPrice: 50,
      discountPercent: 10,
    })
  })

  it('renumbers lines sequentially regardless of stale lineNo', () => {
    const payload = toCreatePayload(baseData, [catalogLine, freeTextLine])
    expect(payload.lines.map((l) => l.lineNumber)).toEqual([1, 2])
  })

  it('maps header fields to the create payload', () => {
    const payload = toCreatePayload(baseData, [])
    expect(payload.customerUuid).toBe('cust-1')
    expect(payload.invoiceUuid).toBe('inv-1')
    expect(payload.salesOrderUuid).toBe('so-1')
    expect(payload.referenceNumber).toBe('REF-1')
    expect(payload.creditMemoDate).toBe('2026-01-01')
    expect(payload.reason).toBe('Damaged goods')
    expect(payload.salesTaxPercent).toBe(8)
    expect(payload.adjustment).toBe(5)
  })

  it('never includes an applications field', () => {
    const payload = toCreatePayload(baseData, [])
    expect(payload).not.toHaveProperty('applications')
  })
})

describe('toUpdatePayload', () => {
  it('carries the given recordVersion for optimistic locking', () => {
    const payload = toUpdatePayload({ credit_memo_date: '2026-01-01' }, [], 7)
    expect(payload.recordVersion).toBe(7)
  })

  it('omits customer/invoice/salesOrder (immutable post-creation)', () => {
    const payload = toUpdatePayload({}, [], 1)
    expect(payload).not.toHaveProperty('customerUuid')
    expect(payload).not.toHaveProperty('invoiceUuid')
    expect(payload).not.toHaveProperty('salesOrderUuid')
  })
})
