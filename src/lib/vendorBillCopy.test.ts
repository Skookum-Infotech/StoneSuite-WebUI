import { describe, it, expect } from 'vitest'
import { fromVendorBillForCopy } from './vendorBillCopy'
import { vendorBillDefaults } from './vendorBillForm'
import type { VendorBill } from '@/types/vendorBill'

const bill = {
  vendorBillNumber: 'VB-4', status: 'Approved', vendorInvoiceNumber: 'INV-778', referenceNumber: 'REF-1',
  billDate: '2020-01-01', dueDate: '2020-02-01', ownerEmployeeId: 4, memo: 'Freight', adjustment: 0, salesTaxPercent: 5,
  purchaseOrder: { id: 'po-1', purchaseOrderNumber: 'PO-8' },
  vendor: { id: 'v-1', name: 'Stone Co' }, customFields: { grade: 'A' },
  items: [{
    lineNumber: 1, itemName: 'Slab', description: 'Grey', sku: 'S-1', quantity: 4, unitCode: 'SQFT',
    unitPrice: 12, discountPercent: 0, lineSubtotal: 48, lineDiscount: 0, lineTotal: 48,
    inventoryItemId: 'inv-1', purchaseOrderItemId: 'poi-1',
  }],
} as unknown as VendorBill

describe('fromVendorBillForCopy', () => {
  const copy = fromVendorBillForCopy(bill)

  it.each([
    ['vb_doc_num', ''],
    ['vendor_invoice_number', ''],
    ['due_date', ''],
    ['owner_employee', ''],
    ['vb_status', 'Draft'],
    ['bill_date', vendorBillDefaults().bill_date],
  ])('resets %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it.each([
    ['reference_number', 'REF-1'],
    ['memo', 'Freight'],
    ['sales_tax_pct', '5'],
  ])('keeps %s', (key, expected) => {
    expect(copy.data[key]).toBe(expected)
  })

  it('carries the vendor and lines but drops the purchase-order link', () => {
    expect(copy.vendor).toEqual({ id: 'v-1', name: 'Stone Co' })
    expect(copy.customFieldValues).toEqual({ grade: 'A' })
    expect(copy.purchaseOrder).toBeNull()
    expect(copy.lineItems[0]).toMatchObject({ itemName: 'Slab', inventoryItemUuid: 'inv-1' })
    expect(copy.lineItems[0].purchaseOrderItemId).toBeUndefined()
  })
})
