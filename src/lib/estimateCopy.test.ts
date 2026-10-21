import { describe, it, expect } from 'vitest'
import { fromEstimateForCopy } from './estimateCopy'
import { estimateDefaults } from './estimateForm'
import type { Estimate } from '@/types/estimate'

const estimate = {
  estimateNumber: 'E-3', status: 'Sent', poNumber: 'PO-9', referenceNumber: 'REF-1', estimateDate: '2020-01-01',
  validUntil: '2020-02-01', ownerEmployeeId: 4, salesRepEmployeeId: 9, memo: 'Rough quote', shipSameAsBilling: true,
  billing: { addrLine1: '1 Main St' }, shipping: {},
  customer: { id: 'c-1', name: 'Acme' }, customFields: { grade: 'A' },
  items: [{
    lineNumber: 1, itemName: 'Slab', description: 'Grey', sku: 'S-1', quantity: 3, unitCode: 'SQFT',
    unitPrice: 10, discountPercent: 0, lineSubtotal: 30, lineTotal: 30, inventoryItemId: 'inv-1',
  }],
} as unknown as Estimate

describe('fromEstimateForCopy', () => {
  const copy = fromEstimateForCopy(estimate)

  it.each([
    ['estimate_doc_num', ''],
    ['purchase_doc_num', ''],
    ['valid_until', ''],
    ['customer_owner', ''],
    ['estimate_status', 'Draft'],
    ['estimate_date', estimateDefaults().estimate_date],
  ])('resets %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it.each([
    ['memo', 'Rough quote'],
    ['reference_number', 'REF-1'],
    ['bill_address1', '1 Main St'],
    ['sales_rep', '9'],
  ])('keeps %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it('carries the customer, custom fields and lines', () => {
    expect(copy.customer).toEqual({ id: 'c-1', name: 'Acme' })
    expect(copy.customFieldValues).toEqual({ grade: 'A' })
    expect(copy.lineItems[0]).toMatchObject({ itemName: 'Slab', inventoryItemUuid: 'inv-1' })
  })
})
