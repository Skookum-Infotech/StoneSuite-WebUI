import { describe, it, expect } from 'vitest'
import { formatBreadcrumbSegment } from './breadcrumb'

describe('formatBreadcrumbSegment', () => {
  it.each([
    ['crm', 'CRM'],
    ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Details'],
    ['estimate', 'Estimate'],
    ['invoice', 'Invoice'],
    ['new', 'New'],
    ['edit', 'Edit'],
    ['sales_order', 'Sales Order'],
    ['credit_memo', 'Credit Memo'],
    ['purchase_order', 'Purchase Order'],
    ['item_receipt', 'Item Receipt'],
    ['vendor_bill', 'Vendor Bill'],
    ['vendor_payment', 'Vendor Payment'],
    ['vendor_credit', 'Vendor Credit'],
    ['record-numbering', 'Record Numbering'],
    ['roles-access', 'Roles Access'],
  ])('formatBreadcrumbSegment(%p) -> %p', (input, expected) => {
    expect(formatBreadcrumbSegment(input)).toBe(expected)
  })
})
