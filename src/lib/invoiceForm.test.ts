import { describe, it, expect } from 'vitest'
import { clampPercent, calcLineItem, toCreatePayload, type InvoiceLineItem } from './invoiceForm'

// clampPercent guards the discount % input on the Invoice items table — see
// InvoiceItemsTab's updateDraft, which applies it on every keystroke since
// rows commit via a button click rather than a native form submit.
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

// calcLineItem uses the header's Sales Tax % (not a per-line field) since the
// Invoice backend has no per-line free-text tax override — see the
// InvoiceLineItem doc comment.
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
    purchase_doc_num: 'PO-1',
    reference_number: 'REF-1',
    invoice_date: '2026-01-01',
    due_date: '2026-01-31',
    sales_tax_pct: '8',
    ship_same_as_bill: false,
  }

  const catalogLine: InvoiceLineItem = {
    id: 'a', lineNo: 1, itemName: 'Widget', itemSku: 'W-1', units: 'ea',
    quantity: '2', unitPrice: '10', discount: '0', amount: '20.00', total: '21.60',
    inventoryItemUuid: 'inv-uuid-1',
  }

  const freeTextLine: InvoiceLineItem = {
    id: 'b', lineNo: 2, itemName: 'Custom fabrication',
    quantity: '1', unitPrice: '50', discount: '10', amount: '45.00', total: '48.60',
  }

  it('sends inventoryItemUuid and omits description for a catalog line', () => {
    const payload = toCreatePayload(baseData, [catalogLine])
    expect(payload.items[0]).toEqual({
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
    expect(payload.items[0]).toEqual({
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
    expect(payload.items.map((i) => i.lineNumber)).toEqual([1, 2])
  })

  it('omits shipping when shipSameAsBilling is true', () => {
    const payload = toCreatePayload({ ...baseData, ship_same_as_bill: true }, [])
    expect(payload.shipSameAsBilling).toBe(true)
    expect(payload.shipping).toBeUndefined()
  })

  it('maps header fields to the create payload', () => {
    const payload = toCreatePayload(baseData, [])
    expect(payload.customerUuid).toBe('cust-1')
    expect(payload.poNumber).toBe('PO-1')
    expect(payload.referenceNumber).toBe('REF-1')
    expect(payload.invoiceDate).toBe('2026-01-01')
    expect(payload.dueDate).toBe('2026-01-31')
    expect(payload.salesTaxPercent).toBe(8)
  })
})
