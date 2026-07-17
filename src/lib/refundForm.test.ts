import { describe, it, expect } from 'vitest'
import {
  toCreatePayload, toUpdatePayload, fromRefund, toRFC3339OrUndefined, fromRFC3339DateOnly,
  REFUND_ALLOWED_TRANSITIONS, transitionPermission, canApply, applyBlockedReason,
  refundApplicationSource, sourceRequestBody, sourceDetailPath,
} from './refundForm'
import type { Refund, RefundApplication } from '@/types/refund'

describe('toRFC3339OrUndefined', () => {
  it.each([
    ['2026-07-16', '2026-07-16T00:00:00Z'],
    ['', undefined],
  ])('toRFC3339OrUndefined(%p) -> %p', (input, expected) => {
    expect(toRFC3339OrUndefined(input)).toBe(expected)
  })
})

describe('fromRFC3339DateOnly', () => {
  it.each([
    ['2026-07-16T00:00:00Z', '2026-07-16'],
    [undefined, ''],
  ])('fromRFC3339DateOnly(%p) -> %p', (input, expected) => {
    expect(fromRFC3339DateOnly(input)).toBe(expected)
  })
})

describe('toCreatePayload', () => {
  const baseData: Record<string, unknown> = {
    refund_method: '1',
    reference_num: 'Check #2077',
    refund_date: '2026-07-16',
    currency_id: '1',
    amount: '250.75',
    reason: 'Overpaid invoice',
    memo: 'Mailed check',
    internal_notes: 'internal only',
  }

  it('maps form fields to the create payload, converting the date to RFC3339', () => {
    const payload = toCreatePayload(baseData, 'cust-uuid-1')
    expect(payload).toEqual({
      customerUuid: 'cust-uuid-1',
      methodId: 1,
      referenceNumber: 'Check #2077',
      refundDate: '2026-07-16T00:00:00Z',
      currencyId: 1,
      amount: 250.75,
      reason: 'Overpaid invoice',
      memo: 'Mailed check',
      internalNotes: 'internal only',
      customFields: {},
    })
  })

  it('omits lineage keys entirely when no lineage is supplied', () => {
    const payload = toCreatePayload(baseData, 'cust-uuid-1')
    expect(payload).not.toHaveProperty('paymentUuid')
    expect(payload).not.toHaveProperty('creditMemoUuid')
    expect(payload).not.toHaveProperty('invoiceUuid')
  })

  it('includes only the lineage keys actually provided', () => {
    const payload = toCreatePayload(baseData, 'cust-uuid-1', { paymentUuid: 'pay-1', invoiceUuid: 'inv-9' })
    expect(payload.paymentUuid).toBe('pay-1')
    expect(payload.invoiceUuid).toBe('inv-9')
    expect(payload).not.toHaveProperty('creditMemoUuid')
  })

  it('never sends an inline applications list — money moves only via /apply (spec §11)', () => {
    const payload = toCreatePayload(baseData, 'cust-uuid-1', { paymentUuid: 'pay-1' })
    expect(payload).not.toHaveProperty('applications')
  })

  it('defaults an unset method to 0 (rejected server-side as "unknown method")', () => {
    const payload = toCreatePayload({ ...baseData, refund_method: '' }, 'cust-uuid-1')
    expect(payload.methodId).toBe(0)
  })

  it('sends a null currencyId when unset', () => {
    const payload = toCreatePayload({ ...baseData, currency_id: '' }, 'cust-uuid-1')
    expect(payload.currencyId).toBeNull()
  })
})

describe('toUpdatePayload', () => {
  it('omits amount/customerUuid/lineage and converts the date', () => {
    const payload = toUpdatePayload({
      refund_method: '4', reference_num: 'ACH-2', refund_date: '2026-08-01',
      currency_id: '', reason: 'Duplicate charge', memo: 'note', internal_notes: '',
    })
    expect(payload).toEqual({
      methodId: 4,
      referenceNumber: 'ACH-2',
      refundDate: '2026-08-01T00:00:00Z',
      currencyId: null,
      reason: 'Duplicate charge',
      memo: 'note',
      internalNotes: '',
      customFields: {},
    })
    expect(payload).not.toHaveProperty('customerUuid')
    expect(payload).not.toHaveProperty('amount')
    expect(payload).not.toHaveProperty('paymentUuid')
    expect(payload).not.toHaveProperty('creditMemoUuid')
    expect(payload).not.toHaveProperty('invoiceUuid')
  })
})

describe('fromRefund', () => {
  const refund: Refund = {
    id: 'rfnd-1',
    refundNumber: 'RFND-000001',
    status: 'Pending',
    statusCode: 'PEND',
    customer: { id: 'cust-1', name: 'Acme Co' },
    methodId: 1,
    method: 'Check',
    referenceNumber: 'REF-9',
    refundDate: '2026-07-16T00:00:00Z',
    currencyId: 1,
    reason: 'Overpayment',
    memo: 'Memo text',
    internalNotes: 'Notes text',
    amount: 250.75,
    appliedTotal: 100,
    unappliedAmount: 150.75,
    customFields: {},
    applications: [],
  }

  it('maps a loaded refund back to editable form state', () => {
    const { data, customer } = fromRefund(refund)
    expect(data).toEqual({
      refund_method: '1',
      reference_num: 'REF-9',
      refund_date: '2026-07-16',
      currency_id: '1',
      reason: 'Overpayment',
      memo: 'Memo text',
      internal_notes: 'Notes text',
    })
    expect(customer).toEqual({ id: 'cust-1', name: 'Acme Co' })
  })

  it('renders a null currencyId as an empty string, not "null"', () => {
    const { data } = fromRefund({ ...refund, currencyId: null })
    expect(data.currency_id).toBe('')
  })
})

describe('REFUND_ALLOWED_TRANSITIONS', () => {
  it('allows PEND to move to APPV or VOID', () => {
    expect(REFUND_ALLOWED_TRANSITIONS.PEND).toEqual(['APPV', 'VOID'])
  })

  it('allows APPV to move to SENT or VOID', () => {
    expect(REFUND_ALLOWED_TRANSITIONS.APPV).toEqual(['SENT', 'VOID'])
  })

  it('has no moves out of SENT — once issued it is terminal, never voidable (AD-3)', () => {
    expect(REFUND_ALLOWED_TRANSITIONS.SENT).toEqual([])
  })

  it('has no moves out of VOID (terminal)', () => {
    expect(REFUND_ALLOWED_TRANSITIONS.VOID).toEqual([])
  })
})

describe('transitionPermission', () => {
  it.each([
    ['APPV', 'approve'],
    ['SENT', 'transition'],
    ['VOID', 'transition'],
  ])('gates a move to %p on refund:%s', (toCode, expected) => {
    expect(transitionPermission(toCode)).toBe(expected)
  })
})

describe('canApply', () => {
  it.each([
    ['PEND', false],
    ['APPV', true],
    ['SENT', false],
    ['VOID', false],
  ])('canApply(%p) -> %p', (statusCode, expected) => {
    expect(canApply(statusCode)).toBe(expected)
  })
})

describe('applyBlockedReason', () => {
  it('tells a PEND refund to get approved first', () => {
    expect(applyBlockedReason('PEND', 100)).toMatch(/approve this refund/i)
  })

  it('gives a generic status reason for other non-APPV statuses', () => {
    expect(applyBlockedReason('VOID', 100)).toMatch(/only an approved refund/i)
  })

  it('blocks an approved refund with nothing left to apply', () => {
    expect(applyBlockedReason('APPV', 0)).toMatch(/no unapplied balance/i)
  })

  it('returns null when an approved refund has a balance to draw', () => {
    expect(applyBlockedReason('APPV', 100)).toBeNull()
  })
})

describe('refundApplicationSource', () => {
  const base: RefundApplication = { id: 'app-1', amount: 50, createdAt: '2026-07-16T00:00:00Z' }

  it('narrows a payment-backed row', () => {
    expect(refundApplicationSource({ ...base, paymentId: 'pay-1', paymentNumber: 'PYMT-000001' }))
      .toEqual({ kind: 'payment', id: 'pay-1', number: 'PYMT-000001' })
  })

  it('narrows a credit-memo-backed row', () => {
    expect(refundApplicationSource({ ...base, creditMemoId: 'cm-1', creditMemoNumber: 'CM-000001' }))
      .toEqual({ kind: 'credit_memo', id: 'cm-1', number: 'CM-000001' })
  })

  it('falls back to an em dash when the source number is missing', () => {
    expect(refundApplicationSource({ ...base, paymentId: 'pay-1' })?.number).toBe('—')
  })

  it('returns null for a row violating the XOR contract, so callers can skip it', () => {
    expect(refundApplicationSource(base)).toBeNull()
  })
})

describe('sourceRequestBody', () => {
  it('sends only paymentUuid for a payment source', () => {
    expect(sourceRequestBody({ kind: 'payment', id: 'pay-1' })).toEqual({ paymentUuid: 'pay-1' })
  })

  it('sends only creditMemoUuid for a credit-memo source', () => {
    expect(sourceRequestBody({ kind: 'credit_memo', id: 'cm-1' })).toEqual({ creditMemoUuid: 'cm-1' })
  })
})

describe('sourceDetailPath', () => {
  it.each([
    [{ kind: 'payment' as const, id: 'pay-1' }, '/sales/payment/pay-1'],
    [{ kind: 'credit_memo' as const, id: 'cm-1' }, '/sales/credit_memo/cm-1'],
  ])('routes %o to %p', (source, expected) => {
    expect(sourceDetailPath(source)).toBe(expected)
  })
})
