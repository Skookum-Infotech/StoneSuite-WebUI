import { describe, it, expect } from 'vitest'
import { toCreatePayload, toUpdatePayload, fromCreditMemo, creditMemoTotals } from './creditMemoForm'
import type { CreditMemo } from '@/types/creditMemo'

describe('creditMemoTotals', () => {
  it.each([
    ['an amount alone', '250', 0, 0, { subtotal: 250, taxTotal: 0, total: 250 }],
    ['tax on top of the amount', '250', 10, 0, { subtotal: 250, taxTotal: 25, total: 275 }],
    ['an adjustment on top of tax', '250', 10, -5, { subtotal: 250, taxTotal: 25, total: 270 }],
    ['tax rounded to the cent like the backend', '19.99', 8.25, 0, { subtotal: 19.99, taxTotal: 1.65, total: 21.64 }],
    ['an empty amount', '', 10, 0, { subtotal: 0, taxTotal: 0, total: 0 }],
    ['a non-numeric amount', 'abc', 10, 5, { subtotal: 0, taxTotal: 0, total: 5 }],
  ])('%s', (_name, amount, taxPercent, adjustment, expected) => {
    expect(creditMemoTotals(amount, taxPercent, adjustment)).toEqual(expected)
  })
})

describe('toCreatePayload', () => {
  const baseData: Record<string, unknown> = {
    customer_uuid: 'cust-1',
    invoice_uuid: 'inv-1',
    sales_order_uuid: 'so-1',
    source_payment_uuid: 'pay-1',
    amount: '24.50',
    reference_number: 'REF-1',
    credit_memo_date: '2026-01-01',
    currency_id: '2',
    reason: 'Damaged goods',
    sales_tax_pct: '8',
    adjustment: '5',
  }

  it('sends the amount and no line items', () => {
    const payload = toCreatePayload(baseData)
    expect(payload.amount).toBe(24.5)
    expect(payload).not.toHaveProperty('lines')
  })

  it('sends the payment the memo is issued from', () => {
    expect(toCreatePayload(baseData).sourcePaymentUuid).toBe('pay-1')
  })

  it('omits the source payment when there is none', () => {
    expect(toCreatePayload({ ...baseData, source_payment_uuid: undefined }).sourcePaymentUuid).toBeUndefined()
    expect(toCreatePayload({ ...baseData, source_payment_uuid: '' }).sourcePaymentUuid).toBeUndefined()
  })

  it('maps header fields to the create payload', () => {
    const payload = toCreatePayload(baseData)
    expect(payload.customerUuid).toBe('cust-1')
    expect(payload.invoiceUuid).toBe('inv-1')
    expect(payload.salesOrderUuid).toBe('so-1')
    expect(payload.referenceNumber).toBe('REF-1')
    expect(payload.creditMemoDate).toBe('2026-01-01')
    expect(payload.currencyId).toBe(2)
    expect(payload.reason).toBe('Damaged goods')
    expect(payload.salesTaxPercent).toBe(8)
    expect(payload.adjustment).toBe(5)
  })

  it('never includes an applications field', () => {
    expect(toCreatePayload(baseData)).not.toHaveProperty('applications')
  })
})

describe('toUpdatePayload', () => {
  it('carries currency and the given recordVersion for optimistic locking', () => {
    const payload = toUpdatePayload({ credit_memo_date: '2026-01-01', currency_id: '2' }, 7)
    expect(payload.currencyId).toBe(2)
    expect(payload.recordVersion).toBe(7)
  })

  it('omits customer/invoice/salesOrder/sourcePayment (immutable post-creation)', () => {
    const payload = toUpdatePayload({}, 1)
    expect(payload).not.toHaveProperty('customerUuid')
    expect(payload).not.toHaveProperty('invoiceUuid')
    expect(payload).not.toHaveProperty('salesOrderUuid')
    expect(payload).not.toHaveProperty('sourcePaymentUuid')
  })

  it('never sends line items', () => {
    expect(toUpdatePayload({ amount: '10' }, 1, {}, '5')).not.toHaveProperty('lines')
  })

  // Sending an unchanged amount would replace a legacy memo's line items with a
  // single amount for no reason, so only an edited amount goes over the wire.
  it.each([
    ['unchanged', '100.00', '100.00', undefined],
    ['unchanged apart from formatting', '100', '100.00', undefined],
    ['edited', '150', '100.00', 150],
  ])('an amount that is %s', (_name, current, original, expected) => {
    expect(toUpdatePayload({ amount: current }, 1, {}, original).amount).toBe(expected)
  })

  it('leaves the amount out when the original is unknown', () => {
    expect(toUpdatePayload({ amount: '10' }, 1)).not.toHaveProperty('amount')
  })
})

describe('fromCreditMemo', () => {
  function memo(overrides: Partial<CreditMemo> = {}): CreditMemo {
    return {
      id: 'cm-1', creditMemoNumber: 'CRDT-000001', status: 'Draft', statusCode: 'DRFT',
      approvalStatus: 'none', gated: false, approvers: [], requiredApprovals: 0, approvedCount: 0,
      canApprove: false, isOverride: false, callerAlreadyApproved: false,
      customer: { id: 'cust-1', name: 'Acme' }, creditMemoDate: '2026-01-01',
      salesTaxPercent: 0, subtotal: 250, discountTotal: 0, taxTotal: 0, adjustment: 0,
      grandTotal: 250, appliedTotal: 0, unappliedAmount: 250, billing: {}, lines: [], applications: [],
      ...overrides,
    }
  }

  it('shows an amount-only memo\'s subtotal as its amount', () => {
    expect(fromCreditMemo(memo()).data.amount).toBe('250.00')
  })

  it('shows a legacy memo\'s subtotal net of its discount as the amount', () => {
    expect(fromCreditMemo(memo({ subtotal: 200, discountTotal: 20 })).data.amount).toBe('180.00')
  })

  it('returns the payment the memo was issued from', () => {
    expect(fromCreditMemo(memo({ sourcePayment: { id: 'pay-1', number: 'PAY-000001' } })).sourcePayment)
      .toEqual({ id: 'pay-1', number: 'PAY-000001' })
    expect(fromCreditMemo(memo()).sourcePayment).toBeNull()
  })

  it('does not return line items', () => {
    expect(fromCreditMemo(memo())).not.toHaveProperty('lineItems')
  })
})
