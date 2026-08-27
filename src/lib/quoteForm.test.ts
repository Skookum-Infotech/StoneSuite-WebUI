import { describe, it, expect } from 'vitest'
import {
  clampPercent, calcLineItem, toCreatePayload, fromQuote, fromSourceEstimate,
  QUOTE_TERMINAL_STATUSES, QUOTE_STATUS_CODES, QUOTE_CONVERTIBLE_STATUSES, validateForSend,
} from './quoteForm'
import type { Quote } from '@/types/quote'
import type { Estimate } from '@/types/estimate'

describe('clampPercent', () => {
  it.each([
    ['', ''],
    ['50', '50'],
    ['150', '100'],
    ['-10', '0'],
    ['abc', 'abc'],
  ])('clampPercent(%p) -> %p', (input, expected) => {
    expect(clampPercent(input)).toBe(expected)
  })
})

describe('calcLineItem', () => {
  it('computes amount and total with discount and header tax applied', () => {
    const result = calcLineItem({ quantity: '10', unitPrice: '20', discount: '10' }, 8)
    // amount = 10 * 20 * (1 - 0.10) = 180.00; total = 180 * 1.08 = 194.40
    expect(result).toEqual({ amount: '180.00', total: '194.40' })
  })

  it('returns empty strings when quantity or unit price is missing', () => {
    expect(calcLineItem({ quantity: '', unitPrice: '20', discount: '0' }, 8)).toEqual({ amount: '', total: '' })
    expect(calcLineItem({ quantity: '10', unitPrice: '', discount: '0' }, 8)).toEqual({ amount: '', total: '' })
  })
})

describe('toCreatePayload', () => {
  const baseData: Record<string, unknown> = {
    customer_uuid: 'cust-1',
    purchase_doc_num: 'PO-88213',
    reference_number: 'REF-1',
    quote_date: '2026-07-14',
    valid_until: '2026-08-13',
    payment_terms: '3',
    price_level: '2',
    currency_id: '1',
    sales_rep: '12',
    customer_owner: '7',
    sales_tax_pct: '8.25',
    memo: 'Test memo',
    ship_same_as_bill: true,
    bill_attn: 'Jane Buyer',
    bill_address1: '123 Main St',
    bill_suite: 'Suite 4',
    bill_city: 'Springfield',
    bill_state: '14',
    bill_country: '1',
    bill_zip: '62701',
    bill_phone: '+1 555-000-1111',
    bill_fax: '+1 555-000-2222',
  }

  it('maps form fields to the create payload', () => {
    const payload = toCreatePayload(baseData, [])
    expect(payload).toMatchObject({
      customerUuid: 'cust-1',
      poNumber: 'PO-88213',
      referenceNumber: 'REF-1',
      quoteDate: '2026-07-14',
      validUntil: '2026-08-13',
      paymentTermsId: 3,
      priceLevelId: 2,
      currencyId: 1,
      salesRepEmployeeId: 12,
      ownerEmployeeId: 7,
      salesTaxPercent: 8.25,
      memo: 'Test memo',
      shipSameAsBilling: true,
      billing: {
        attention: 'Jane Buyer',
        addrLine1: '123 Main St',
        suiteUnit: 'Suite 4',
        city: 'Springfield',
        stateId: 14,
        countryId: 1,
        zip: '62701',
        phone: '+1 555-000-1111',
        fax: '+1 555-000-2222',
      },
      shipping: undefined,
      items: [],
    })
    expect(payload.estimateUuid).toBeUndefined()
  })

  it('includes estimateUuid when a source estimate id is passed', () => {
    const payload = toCreatePayload(baseData, [], 'est-uuid-1')
    expect(payload.estimateUuid).toBe('est-uuid-1')
  })

  it('sends a distinct shipping block when ship_same_as_bill is false', () => {
    const payload = toCreatePayload({
      ...baseData, ship_same_as_bill: false,
      ship_customer: 'Warehouse Co', ship_attn: 'Dock Manager', ship_address1: '9 Dock Rd', ship_suite: '',
      ship_city: 'Metropolis', ship_state: '33', ship_country: '1', ship_zip: '10001',
      ship_phone: '+1 555-000-3333', ship_fax: '',
    }, [])
    expect(payload.shipping).toEqual({
      customerName: 'Warehouse Co',
      attention: 'Dock Manager',
      addrLine1: '9 Dock Rd',
      addrLine2: '',
      suiteUnit: '',
      city: 'Metropolis',
      stateId: 33,
      countryId: 1,
      zip: '10001',
      phone: '+1 555-000-3333',
      fax: '',
    })
  })

  it('maps line items with a 1-based lineNumber, dropping UI-only display fields', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'a', lineNo: 1, itemName: 'Widget', itemDescription: '', quantity: '25.5', unitPrice: '42', discount: '5', amount: '1017.79', total: '1101.30', inventoryItemUuid: 'inv-1' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, inventoryItemUuid: 'inv-1', quantity: 25.5, unitPrice: 42, discountPercent: 5 },
    ])
  })

  it('maps a free-text line item, sending description instead of inventoryItemUuid', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'b', lineNo: 1, itemName: 'Custom labor', itemDescription: '', quantity: '5', unitPrice: '50', discount: '0', amount: '250.00', total: '270.63' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, description: 'Custom labor', quantity: 5, unitPrice: 50, discountPercent: 0 },
    ])
  })

  it('sends an explicit itemDescription for a catalog-picked line, overriding the catalog item', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'c', lineNo: 1, itemName: 'Widget', itemDescription: 'Blue widget, medium', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00', inventoryItemUuid: 'inv-1' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, inventoryItemUuid: 'inv-1', description: 'Blue widget, medium', quantity: 1, unitPrice: 10, discountPercent: 0 },
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

describe('fromQuote', () => {
  const quote: Quote = {
    id: 'q-1',
    quoteNumber: 'QUOT-000001',
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
    estimate: null,
    quoteDate: '2026-07-14',
    validUntil: '2026-08-13',
    poNumber: 'PO-88213',
    referenceNumber: 'REF-1',
    memo: 'Memo text',
    paymentTermsId: 3,
    priceLevelId: 2,
    currencyId: 1,
    salesRepEmployeeId: 12,
    ownerEmployeeId: 7,
    salesTaxPercent: 8.25,
    shipSameAsBilling: true,
    billing: { addrLine1: '123 Main St', city: 'Springfield', stateId: 14, countryId: 1, zip: '62701' },
    shipping: {},
    subtotal: 1500,
    discountTotal: 75,
    taxTotal: 118.14,
    shippingCharge: 0,
    adjustment: 0,
    grandTotal: 1543.14,
    items: [
      {
        id: 'line-1', lineNumber: 1, inventoryItemId: 'inv-1', sku: 'SKU-001', itemName: 'Widget',
        description: '', unitCode: 'EA', quantity: 25.5, unitPrice: 42, discountPercent: 5, taxPercent: 8.25,
        lineSubtotal: 1017.79, lineDiscount: 53.55, lineTax: 83.85, lineTotal: 1101.30,
      },
    ],
  }

  it('maps a loaded quote back to editable form state', () => {
    const { data, customer } = fromQuote(quote)
    expect(data).toMatchObject({
      quote_doc_num: 'QUOT-000001',
      purchase_doc_num: 'PO-88213',
      reference_number: 'REF-1',
      quote_date: '2026-07-14',
      valid_until: '2026-08-13',
      sales_tax_pct: '8.25',
      bill_address1: '123 Main St',
      bill_city: 'Springfield',
      bill_state: '14',
      bill_country: '1',
      bill_zip: '62701',
    })
    expect(customer).toEqual({ id: 'cust-1', name: 'Acme Corp' })
  })

  it('maps line items, preferring itemName over description', () => {
    const { lineItems } = fromQuote(quote)
    expect(lineItems).toHaveLength(1)
    expect(lineItems[0]).toMatchObject({
      lineNo: 1, itemName: 'Widget', itemSku: 'SKU-001', units: 'EA',
      quantity: '25.5', unitPrice: '42', discount: '5', inventoryItemUuid: 'inv-1',
    })
  })
})

describe('fromSourceEstimate', () => {
  const estimate: Estimate = {
    id: 'est-1',
    estimateNumber: 'ESTM-000012',
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
    estimateDate: '2026-07-01',
    paymentTermsId: null,
    priceLevelId: null,
    currencyId: null,
    salesRepEmployeeId: null,
    ownerEmployeeId: null,
    salesTaxPercent: 8.25,
    shipSameAsBilling: true,
    billing: {},
    shipping: {},
    subtotal: 1000,
    discountTotal: 0,
    taxTotal: 82.5,
    shippingCharge: 0,
    adjustment: 0,
    grandTotal: 1082.5,
    poNumber: 'PO-99',
    memo: 'Estimate memo',
    items: [
      {
        id: 'line-1', lineNumber: 1, inventoryItemId: 'inv-1', sku: 'SKU-001', itemName: 'Widget',
        description: '', unitCode: 'EA', quantity: 10, unitPrice: 100, discountPercent: 0, taxPercent: 8.25,
        lineSubtotal: 1000, lineDiscount: 0, lineTax: 82.5, lineTotal: 1082.5,
      },
      {
        id: 'line-2', lineNumber: 2, inventoryItemId: null, sku: '', itemName: '', description: 'Custom labor',
        unitCode: '', quantity: 5, unitPrice: 50, discountPercent: 0, taxPercent: 8.25,
        lineSubtotal: 250, lineDiscount: 0, lineTax: 20.63, lineTotal: 270.63,
      },
    ],
  }

  it('prefills header fields and customer from the estimate', () => {
    const { data, customer } = fromSourceEstimate(estimate)
    expect(data).toEqual({
      purchase_doc_num: 'PO-99',
      sales_tax_pct: '8.25',
      memo: 'Estimate memo',
    })
    expect(customer).toEqual({ id: 'cust-1', name: 'Acme Corp' })
  })

  it('carries free-text estimate lines over as free-text quote lines', () => {
    const { lineItems } = fromSourceEstimate(estimate)
    expect(lineItems).toHaveLength(2)
    expect(lineItems[0]).toMatchObject({ itemName: 'Widget', inventoryItemUuid: 'inv-1' })
    expect(lineItems[1]).toMatchObject({ itemName: 'Custom labor', inventoryItemUuid: undefined })
  })
})

describe('QUOTE_TERMINAL_STATUSES', () => {
  it('treats RJCT, EXPR, and CANC as terminal', () => {
    expect(QUOTE_TERMINAL_STATUSES.has('RJCT')).toBe(true)
    expect(QUOTE_TERMINAL_STATUSES.has('EXPR')).toBe(true)
    expect(QUOTE_TERMINAL_STATUSES.has('CANC')).toBe(true)
    expect(QUOTE_TERMINAL_STATUSES.has('DRFT')).toBe(false)
  })

  it('matches every non-terminal code in QUOTE_STATUS_CODES for reference', () => {
    const nonTerminal = QUOTE_STATUS_CODES.map((s) => s.code).filter((c) => !QUOTE_TERMINAL_STATUSES.has(c))
    expect(nonTerminal).toEqual(['DRFT', 'PAPV', 'APPV', 'SENT'])
  })
})

describe('QUOTE_CONVERTIBLE_STATUSES', () => {
  it.each([
    ['DRFT', false],
    ['PAPV', false],
    ['APPV', true],
    ['SENT', true],
    ['RJCT', false],
    ['EXPR', false],
    ['CANC', false],
  ])('has(%p) -> %p', (code, expected) => {
    expect(QUOTE_CONVERTIBLE_STATUSES.has(code)).toBe(expected)
  })
})

// validateForSend gates the Quote detail page's "Send to Customer" quick
// action — see QuoteDetailPage's handleSendClick. The billing email check
// mirrors the backend's own requirement (the generic /document/send route
// 400s "At least one recipient is required" when billing.email is blank and
// no `to` override is supplied).
const baseSendQuote: Pick<Quote, 'customer' | 'items' | 'billing'> = {
  customer: { id: 'cust-1', name: 'Acme Co' },
  items: [{
    id: 'line-1', lineNumber: 1, sku: '', itemName: 'Item', description: '',
    unitCode: '', quantity: 1, unitPrice: 10, discountPercent: 0, taxPercent: 0,
    lineSubtotal: 10, lineDiscount: 0, lineTax: 0, lineTotal: 10,
  }],
  billing: { email: 'billing@acme.test' },
}

describe('validateForSend', () => {
  it('returns no errors when customer, items, and billing email are all present', () => {
    expect(validateForSend(baseSendQuote)).toEqual([])
  })

  it('flags a missing customer', () => {
    expect(validateForSend({ ...baseSendQuote, customer: { id: '', name: '' } }))
      .toContain('A customer is required.')
  })

  it('flags an empty items array', () => {
    expect(validateForSend({ ...baseSendQuote, items: [] }))
      .toContain('At least one line item is required.')
  })

  it.each([
    [undefined],
    [''],
    ['   '],
  ])('flags a missing/blank billing email (%p)', (email) => {
    expect(validateForSend({ ...baseSendQuote, billing: { email } }))
      .toContain('A billing email is required to send this quote.')
  })

  it('returns all applicable errors at once, not just the first', () => {
    const errors = validateForSend({ customer: { id: '', name: '' }, items: [], billing: { email: '' } })
    expect(errors).toHaveLength(3)
  })
})
