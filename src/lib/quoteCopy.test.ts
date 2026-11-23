import { describe, it, expect } from 'vitest'
import { fromQuoteForCopy } from './quoteCopy'
import { quoteDefaults } from './quoteForm'
import type { Quote } from '@/types/quote'

const quote = {
  quoteNumber: 'Q-5', status: 'Sent', poNumber: 'PO-9', referenceNumber: 'REF-1', quoteDate: '2020-01-01',
  validUntil: '2020-02-01', ownerEmployeeId: 4, salesRepEmployeeId: 9, memo: 'Net 30', shipSameAsBilling: true,
  billing: { addrLine1: '1 Main St' }, shipping: {},
  customer: { id: 'c-1', name: 'Acme' }, customFields: { grade: 'A' },
  items: [{
    lineNumber: 1, itemName: 'Slab', description: 'Grey', sku: 'S-1', quantity: 3, unitCode: 'SQFT',
    unitPrice: 10, discountPercent: 5, lineSubtotal: 30, lineTotal: 28.5, inventoryItemId: 'inv-1',
  }],
} as unknown as Quote

describe('fromQuoteForCopy', () => {
  const copy = fromQuoteForCopy(quote)

  it.each([
    ['quote_doc_num', ''],
    ['purchase_doc_num', ''],
    ['valid_until', ''],
    ['customer_owner', ''],
    ['quote_status', 'Draft'],
    ['quote_date', quoteDefaults().quote_date],
  ])('resets %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it.each([
    ['memo', 'Net 30'],
    ['reference_number', 'REF-1'],
    ['bill_address1', '1 Main St'],
    ['sales_rep', '9'],
  ])('keeps %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it('carries the customer, custom fields and lines', () => {
    expect(copy.customer).toEqual({ id: 'c-1', name: 'Acme' })
    expect(copy.customFieldValues).toEqual({ grade: 'A' })
    expect(copy.lineItems[0]).toMatchObject({ itemName: 'Slab', inventoryItemUuid: 'inv-1', discount: '5' })
  })
})
