import { describe, it, expect } from 'vitest'
import { clampPercent, calcLineItem, toCreatePayload, fromInvoice, type InvoiceLineItem } from './invoiceForm'
import type { Invoice } from '@/types/invoice'

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
    id: 'a', lineNo: 1, itemName: 'Widget', itemDescription: '', itemSku: 'W-1', units: 'ea',
    quantity: '2', unitPrice: '10', discount: '0', amount: '20.00', total: '21.60',
    inventoryItemUuid: 'inv-uuid-1',
  }

  const freeTextLine: InvoiceLineItem = {
    id: 'b', lineNo: 2, itemName: 'Custom fabrication', itemDescription: '',
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

describe('toCreatePayload line item description mapping', () => {
  const baseData: Record<string, unknown> = { customer_uuid: 'cust-1', ship_same_as_bill: true }

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
      { id: 'c', lineNo: 1, itemName: 'Custom labor', itemDescription: '', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, description: 'Custom labor', quantity: 1, unitPrice: 10, discountPercent: 0 },
    ])
  })

  it('prefers an explicit itemDescription over itemName for a free-text line', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'd', lineNo: 1, itemName: 'Custom labor', itemDescription: 'Installation and setup', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, description: 'Installation and setup', quantity: 1, unitPrice: 10, discountPercent: 0 },
    ])
  })

  it('falls back to itemName when itemDescription is blank/whitespace-only on a free-text line', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'e', lineNo: 1, itemName: 'Custom labor', itemDescription: '   ', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, description: 'Custom labor', quantity: 1, unitPrice: 10, discountPercent: 0 },
    ])
  })
})

// Regression coverage for a converted line whose item_name was never
// snapshotted (quote/store_create.go's free-text branch drops it, and the
// gap rides the convert chain to sales order and invoice): fromInvoice must
// fall back to description for itemName and capture it into itemDescription,
// or a re-save/status transition sends neither field and the backend rejects
// it ("each line needs an inventoryItemUuid or a description").
describe('fromInvoice', () => {
  const baseInvoice: Invoice = {
    id: 'inv-1',
    invoiceNumber: 'INVC-000001',
    status: 'Draft',
    statusCode: 'DRFT',
    approvalStatus: 'none',
    gated: false,
    approvers: [],
    requiredApprovals: 0,
    approvedCount: 0,
    canApprove: false,
    isOverride: false,
    callerAlreadyApproved: false,
    customer: { id: 'cust-1', name: 'Acme Corp' },
    invoiceDate: '2026-07-18',
    paymentTermsId: null,
    priceLevelId: null,
    currencyId: null,
    exchangeRate: 1,
    salesTaxPercent: 0,
    subtotal: 20,
    discountTotal: 0,
    taxTotal: 0,
    shippingCharge: 0,
    adjustment: 0,
    grandTotal: 20,
    amountPaid: 0,
    balanceDue: 20,
    shipSameAsBilling: true,
    billing: {},
    shipping: {},
    items: [],
  }

  it('falls back to description for itemName on a converted line with a blank item_name, and captures the description independently', () => {
    const invoice: Invoice = {
      ...baseInvoice,
      items: [
        {
          id: 'line-1', lineNumber: 1, salesOrderItemId: 'so-item-1', sku: '', itemName: '',
          description: 'FOOTBALL in item section', unitCode: '', quantity: 10, unitPrice: 2,
          discountPercent: 0, taxPercent: 0, lineSubtotal: 20, lineDiscount: 0, lineTax: 0, lineTotal: 20,
        },
      ],
    }
    const { lineItems } = fromInvoice(invoice)
    expect(lineItems).toHaveLength(1)
    expect(lineItems[0]).toMatchObject({
      lineNo: 1,
      itemName: 'FOOTBALL in item section',
      itemDescription: 'FOOTBALL in item section',
      inventoryItemUuid: undefined,
    })
  })

  it('keeps itemName and itemDescription independent when both are already populated', () => {
    const invoice: Invoice = {
      ...baseInvoice,
      items: [
        {
          id: 'line-1', lineNumber: 1, inventoryItemId: 'inv-item-1', sku: 'SKU-1', itemName: 'Widget',
          description: 'Blue widget, medium', unitCode: 'EA', quantity: 1, unitPrice: 20,
          discountPercent: 0, taxPercent: 0, lineSubtotal: 20, lineDiscount: 0, lineTax: 0, lineTotal: 20,
        },
      ],
    }
    const { lineItems } = fromInvoice(invoice)
    expect(lineItems[0]).toMatchObject({
      itemName: 'Widget',
      itemDescription: 'Blue widget, medium',
      inventoryItemUuid: 'inv-item-1',
    })
  })
})
