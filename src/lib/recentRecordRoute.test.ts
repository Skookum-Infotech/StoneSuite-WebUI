import { describe, it, expect } from 'vitest'
import { recordRoute, relativeTime } from './recentRecordRoute'

describe('recordRoute', () => {
  it.each([
    ['crm', 'lead', 'id-1', '/crm/lead/id-1'],
    ['crm', 'prospect', 'id-2', '/crm/prospect/id-2'],
    ['crm', 'customer', 'id-3', '/crm/customer/id-3'],
    ['sales', 'quote', 'id-4', '/sales/quote/id-4'],
    ['sales', 'estimate', 'id-5', '/sales/estimate/id-5'],
    ['sales', 'sales_order', 'id-6', '/sales/sales_order/id-6'],
    ['sales', 'invoice', 'id-7', '/sales/invoice/id-7'],
    ['sales', 'payment', 'id-8', '/sales/payment/id-8'],
    ['sales', 'credit_memo', 'id-9', '/sales/credit_memo/id-9'],
    ['sales', 'refund', 'id-10', '/sales/refund/id-10'],
    ['purchases', 'requisition', 'id-11', '/purchases/requisition/id-11'],
    ['purchases', 'purchase_order', 'id-12', '/purchases/purchase_order/id-12'],
    ['purchases', 'item_receipt', 'id-13', '/purchases/item_receipt/id-13'],
    ['purchases', 'vendor_bill', 'id-14', '/purchases/vendor_bill/id-14'],
    ['purchases', 'vendor_payment', 'id-15', '/purchases/vendor_payment/id-15'],
    ['purchases', 'vendor_credit', 'id-16', '/purchases/vendor_credit/id-16'],
    ['purchases', 'expense', 'id-17', '/purchases/expense/id-17'],
  ])('recordRoute(%p, %p, %p) -> %p', (domain, module, id, expected) => {
    expect(recordRoute(domain, module, id)).toBe(expected)
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-09-02T12:00:00Z')

  it.each([
    ['30 seconds ago reads as just now', '2026-09-02T11:59:30Z', 'just now'],
    ['5 minutes ago', '2026-09-02T11:55:00Z', '5m ago'],
    ['1 hour 30 minutes ago rounds down to whole hours', '2026-09-02T10:30:00Z', '1h ago'],
    ['3 days ago', '2026-08-30T12:00:00Z', '3d ago'],
    ['6 days ago is still relative', '2026-08-27T12:00:00Z', '6d ago'],
  ])('%s', (_label, iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected)
  })

  it('falls back to a calendar date once the gap exceeds a week', () => {
    const result = relativeTime('2026-08-01T12:00:00Z', now)
    expect(result).not.toMatch(/ago/)
    expect(result).toContain('2026')
  })

  it('returns an em dash for an unparseable timestamp instead of "Invalid Date"', () => {
    expect(relativeTime('not-a-date', now)).toBe('—')
  })
})
