import { describe, it, expect } from 'vitest'
import {
  toCreatePayload, toUpdatePayload, fromPayment, toRFC3339OrUndefined, fromRFC3339DateOnly,
  PAYMENT_ALLOWED_TRANSITIONS,
} from './paymentForm'
import type { Payment } from '@/types/payment'

describe('toRFC3339OrUndefined', () => {
  it.each([
    ['2026-07-15', '2026-07-15T00:00:00Z'],
    ['', undefined],
  ])('toRFC3339OrUndefined(%p) -> %p', (input, expected) => {
    expect(toRFC3339OrUndefined(input)).toBe(expected)
  })
})

describe('fromRFC3339DateOnly', () => {
  it.each([
    ['2026-07-15T00:00:00Z', '2026-07-15'],
    [undefined, ''],
  ])('fromRFC3339DateOnly(%p) -> %p', (input, expected) => {
    expect(fromRFC3339DateOnly(input)).toBe(expected)
  })
})

describe('toCreatePayload', () => {
  const baseData: Record<string, unknown> = {
    payment_method: '3',
    reference_num: 'Check #1042',
    payment_date: '2026-07-15',
    currency_id: '1',
    amount: '1500.5',
    memo: 'July payment',
    internal_notes: 'internal only',
  }

  it('maps form fields to the create payload, converting the date to RFC3339', () => {
    const payload = toCreatePayload(baseData, 'cust-uuid-1')
    expect(payload).toEqual({
      customerUuid: 'cust-uuid-1',
      methodId: 3,
      referenceNumber: 'Check #1042',
      paymentDate: '2026-07-15T00:00:00Z',
      currencyId: 1,
      amount: 1500.5,
      memo: 'July payment',
      internalNotes: 'internal only',
      customFields: {},
    })
  })

  it('defaults an unset method to 0 (rejected server-side as "unknown method")', () => {
    const payload = toCreatePayload({ ...baseData, payment_method: '' }, 'cust-uuid-1')
    expect(payload.methodId).toBe(0)
  })

  it('sends a null currencyId when unset', () => {
    const payload = toCreatePayload({ ...baseData, currency_id: '' }, 'cust-uuid-1')
    expect(payload.currencyId).toBeNull()
  })
})

describe('toUpdatePayload', () => {
  it('omits amount/customerUuid/applications and converts the date', () => {
    const payload = toUpdatePayload({
      payment_method: '2', reference_num: 'REF-2', payment_date: '2026-08-01',
      currency_id: '', memo: 'note', internal_notes: '',
    })
    expect(payload).toEqual({
      methodId: 2,
      referenceNumber: 'REF-2',
      paymentDate: '2026-08-01T00:00:00Z',
      currencyId: null,
      memo: 'note',
      internalNotes: '',
      customFields: {},
    })
    expect(payload).not.toHaveProperty('customerUuid')
    expect(payload).not.toHaveProperty('amount')
    expect(payload).not.toHaveProperty('applications')
  })
})

describe('fromPayment', () => {
  const payment: Payment = {
    id: 'pay-1',
    paymentNumber: 'PYMT-000001',
    status: 'Pending',
    statusCode: 'PEND',
    approvalStatus: 'none',
    gated: false,
    approvers: [],
    requiredApprovals: 0,
    approvedCount: 0,
    canApprove: false,
    isOverride: false,
    callerAlreadyApproved: false,
    customer: { id: 'cust-1', name: 'Acme Co' },
    methodId: 3,
    method: 'Credit Card',
    referenceNumber: 'REF-9',
    paymentDate: '2026-07-15T00:00:00Z',
    currencyId: 1,
    memo: 'Memo text',
    internalNotes: 'Notes text',
    amount: 1500.5,
    appliedTotal: 500,
    unappliedAmount: 1000.5,
    customFields: {},
    applications: [],
  }

  it('maps a loaded payment back to editable form state', () => {
    const { data, customer } = fromPayment(payment)
    expect(data).toEqual({
      payment_method: '3',
      reference_num: 'REF-9',
      payment_date: '2026-07-15',
      currency_id: '1',
      memo: 'Memo text',
      internal_notes: 'Notes text',
    })
    expect(customer).toEqual({ id: 'cust-1', name: 'Acme Co' })
  })

  it('renders a null currencyId as an empty string, not "null"', () => {
    const { data } = fromPayment({ ...payment, currencyId: null })
    expect(data.currency_id).toBe('')
  })
})

describe('PAYMENT_ALLOWED_TRANSITIONS', () => {
  it('allows PEND to move to APPV or VOID', () => {
    expect(PAYMENT_ALLOWED_TRANSITIONS.PEND).toEqual(['APPV', 'VOID'])
  })

  it('allows APPV to move to DEPO or VOID', () => {
    expect(PAYMENT_ALLOWED_TRANSITIONS.APPV).toEqual(['DEPO', 'VOID'])
  })

  it('has no moves out of DEPO or VOID (terminal)', () => {
    expect(PAYMENT_ALLOWED_TRANSITIONS.DEPO).toEqual([])
    expect(PAYMENT_ALLOWED_TRANSITIONS.VOID).toEqual([])
  })
})
