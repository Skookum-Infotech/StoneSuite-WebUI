import { describe, it, expect } from 'vitest'
import { fromOrderForCopy } from './salesOrderCopy'
import { soDefaults } from './salesOrderForm'
import type { SalesOrder } from '@/types/salesOrder'

const order = {
  salesOrderNumber: 'SO-7', status: 'Approved', poNumber: 'PO-123', orderDate: '2020-01-01',
  scheduledInstallDate: '2020-02-01', paymentDueDate: '2020-03-01', ownerEmployeeId: 4, salesRepEmployeeId: 9,
  memo: 'Handle with care', shipSameAsBilling: false, salesTaxPercent: 8,
  billing: { addrLine1: '1 Main St' }, shipping: { addrLine1: '2 Dock Rd' },
  customer: { id: 'c-1', name: 'Acme' }, customFields: { grade: 'A' },
  items: [{
    lineNumber: 1, itemName: 'Slab', description: 'Grey', sku: 'S-1', quantity: 2, unitCode: 'SQFT',
    unitPrice: 10, discountPercent: 0, lineSubtotal: 20, taxPercent: 0, lineTotal: 20,
    inventoryItemId: 'inv-1', fulfilledQuantity: 2, status: 'filled',
  }],
} as unknown as SalesOrder

describe('fromOrderForCopy', () => {
  const copy = fromOrderForCopy(order)

  it.each([
    ['sales_doc_num', ''],
    ['purchase_doc_num', ''],
    ['scheduled_install_date', ''],
    ['payment_due_date', ''],
    ['customer_owner', ''],
    ['sales_order_status', 'Draft'],
    ['date_created', soDefaults().date_created],
  ])('resets %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it.each([
    ['memo', 'Handle with care'],
    ['bill_address1', '1 Main St'],
    ['ship_address1', '2 Dock Rd'],
    ['sales_rep', '9'],
    ['sales_tax_pct', '8'],
  ])('keeps %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it('carries the customer, custom fields and lines, with fulfilment cleared', () => {
    expect(copy.customer).toEqual({ id: 'c-1', name: 'Acme' })
    expect(copy.customFieldValues).toEqual({ grade: 'A' })
    expect(copy.lineItems).toHaveLength(1)
    expect(copy.lineItems[0]).toMatchObject({ itemName: 'Slab', inventoryItemUuid: 'inv-1', quantity: '2' })
    expect(copy.lineItems[0].fulfilledQuantity).toBeUndefined()
    expect(copy.lineItems[0].status).toBeUndefined()
  })
})
