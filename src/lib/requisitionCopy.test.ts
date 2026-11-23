import { describe, it, expect } from 'vitest'
import { fromRequisitionForCopy } from './requisitionCopy'
import type { Requisition } from '@/types/requisition'

const reqn = {
  requisitionNumber: 'REQ-2', status: 'Approved', requestedByEmployeeId: 4, department: 'Fabrication',
  neededByDate: '2020-02-01', priority: 'high', memo: 'Restock', paymentTermsId: 2, salesTaxPercent: 5,
  vendor: { id: 'v-1', name: 'Stone Co' }, customFields: { grade: 'A' },
  items: [{
    lineNumber: 1, itemName: 'Slab', description: 'Grey', sku: 'S-1', quantity: 4, unitCode: 'SQFT',
    estimatedUnitPrice: 12, estimatedAmount: 48, inventoryItemId: 'inv-1',
  }],
} as unknown as Requisition

describe('fromRequisitionForCopy', () => {
  const copy = fromRequisitionForCopy(reqn)

  it.each([
    ['reqn_doc_num', ''],
    ['requested_by', ''],
    ['needed_by_date', ''],
    ['reqn_status', 'Draft'],
  ])('resets %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it.each([
    ['department', 'Fabrication'],
    ['memo', 'Restock'],
    ['payment_terms', '2'],
    ['sales_tax_pct', '5'],
  ])('keeps %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it('carries the suggested vendor, custom fields and lines', () => {
    expect(copy.vendor).toEqual({ id: 'v-1', name: 'Stone Co' })
    expect(copy.customFieldValues).toEqual({ grade: 'A' })
    expect(copy.lineItems[0]).toMatchObject({ itemName: 'Slab', inventoryItemUuid: 'inv-1', quantity: '4' })
  })
})
