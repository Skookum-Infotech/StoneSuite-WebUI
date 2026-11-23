import { describe, it, expect } from 'vitest'
import { fromPurchaseOrderForCopy } from './purchaseOrderCopy'
import { purchaseOrderDefaults } from './purchaseOrderForm'
import type { PurchaseOrder } from '@/types/purchaseOrder'

const po = {
  purchaseOrderNumber: 'PO-8', status: 'Sent', referenceNumber: 'REF-1', orderDate: '2020-01-01',
  expectedDate: '2020-02-01', ownerEmployeeId: 4, memo: 'Rush', notes: 'Call first', termsConditions: 'Net 30',
  shippingCharge: 25, adjustment: 0, salesTaxPercent: 5,
  shipTo: { name: 'Warehouse', addrLine1: '9 Dock Rd' },
  vendor: { id: 'v-1', name: 'Stone Co' }, customFields: { grade: 'A' },
  items: [{
    lineNumber: 1, itemName: 'Slab', description: 'Grey', sku: 'S-1', quantity: 4, unitCode: 'SQFT',
    unitPrice: 12, discountPercent: 0, lineSubtotal: 48, lineDiscount: 0, lineTotal: 48, inventoryItemId: 'inv-1',
  }],
} as unknown as PurchaseOrder

describe('fromPurchaseOrderForCopy', () => {
  const copy = fromPurchaseOrderForCopy(po)

  it.each([
    ['po_doc_num', ''],
    ['expected_date', ''],
    ['owner_employee', ''],
    ['po_status', 'Draft'],
    ['order_date', purchaseOrderDefaults().order_date],
  ])('resets %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it.each([
    ['reference_number', 'REF-1'],
    ['memo', 'Rush'],
    ['terms_conditions', 'Net 30'],
    ['ship_address1', '9 Dock Rd'],
    ['shipping_charge', '25'],
  ])('keeps %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it('carries the vendor, custom fields and lines', () => {
    expect(copy.vendor).toEqual({ id: 'v-1', name: 'Stone Co' })
    expect(copy.customFieldValues).toEqual({ grade: 'A' })
    expect(copy.lineItems[0]).toMatchObject({ itemName: 'Slab', inventoryItemUuid: 'inv-1', quantity: '4' })
  })
})
