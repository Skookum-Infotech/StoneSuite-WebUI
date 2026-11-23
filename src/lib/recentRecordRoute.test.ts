import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recordRoute, relativeTime, relativeDay } from './recentRecordRoute'

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

// Pinned west of UTC so a UTC-midnight reading of the date would land a day
// early and fail these. Node re-reads TZ on assignment.
describe('relativeDay in America/Chicago', () => {
  let originalTZ: string | undefined

  beforeAll(() => {
    originalTZ = process.env.TZ
    process.env.TZ = 'America/Chicago'
  })

  afterAll(() => {
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  // 8 PM on Jan 2 in Chicago -- already Jan 3 in UTC.
  const evening = () => new Date(2026, 0, 2, 20, 0)

  it.each([
    ['the same calendar day', '2026-01-02', 'Today'],
    ['the previous day', '2026-01-01', 'Yesterday'],
    ['a few days back, across a year boundary', '2025-12-29', '4d ago'],
    ['the last day inside the window', '2025-12-27', '6d ago'],
  ])('%s', (_name, value, expected) => {
    expect(relativeDay(value, evening())).toBe(expected)
  })

  it.each([
    ['a week or more back', '2025-12-26'],
    ['a future date', '2026-01-05'],
  ])('falls back to the calendar date for %s', (_name, value) => {
    const [y, m, d] = value.split('-').map(Number)
    const expected = new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    expect(relativeDay(value, evening())).toBe(expected)
  })

  it('counts a DST-shortened day as one day', () => {
    // US spring-forward is 2026-03-08: that local day is 23 hours long.
    expect(relativeDay('2026-03-08', new Date(2026, 2, 9, 9, 0))).toBe('Yesterday')
  })

  it.each([['an empty string', ''], ['garbage', 'not-a-date'], ['a timestamp', '2026-01-02T00:00:00Z']])(
    'returns an em dash for %s',
    (_name, value) => {
      expect(relativeDay(value, evening())).toBe('—')
    },
  )
})
