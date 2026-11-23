import { describe, it, expect } from 'vitest'
import {
  clampPercent, fromOrder, PRIMARY_INFO_FIELDS, SO_CONVERTIBLE_STATUSES, toCreatePayload, validateForSend,
} from './salesOrderForm'
import type { SalesOrder } from '@/types/salesOrder'

// clampPercent guards discount/tax % inputs on the Sales Order items table —
// see SalesOrderItemsTab's updateDraft, which applies it on every keystroke
// since rows commit via a button click rather than a native form submit.
describe('clampPercent', () => {
  it.each([
    ['', ''],
    ['50', '50'],
    ['0', '0'],
    ['100', '100'],
    ['-5', '0'],
    ['150', '100'],
    ['-0.5', '0'],
    ['100.5', '100'],
  ])('clampPercent(%p) -> %p', (input, expected) => {
    expect(clampPercent(input)).toBe(expected)
  })

  it('leaves a non-numeric in-progress value untouched', () => {
    expect(clampPercent('-')).toBe('-')
  })
})

describe('SO_CONVERTIBLE_STATUSES', () => {
  it.each([
    ['DRFT', false],
    ['PAPV', false],
    ['APPV', true],
    ['OPEN', true],
    ['PART', true],
    ['FILL', true],
    ['CANC', false],
  ])('has(%p) -> %p', (code, expected) => {
    expect(SO_CONVERTIBLE_STATUSES.has(code)).toBe(expected)
  })
})

// validateForSend gates the Sales Order detail page's "Send to Customer"
// quick action — see SalesOrderDetailPage's handleSendClick. The billing
// email check mirrors the backend's own requirement (the generic
// /document/send route 400s "At least one recipient is required" when
// billing.email is blank and no `to` override is supplied).
const baseSendOrder: Pick<SalesOrder, 'customer' | 'items' | 'billing'> = {
  customer: { id: 'cust-1', name: 'Acme Co' },
  items: [{
    id: 'line-1', lineNumber: 1, sku: '', itemName: 'Item', description: '',
    unitCode: '', quantity: 1, unitPrice: 10, discountPercent: 0, taxPercent: 0,
    lineSubtotal: 10, lineDiscount: 0, lineTax: 0, lineTotal: 10,
    fulfilledQuantity: 0, status: 'open',
  }],
  billing: { email: 'billing@acme.test' },
}

describe('validateForSend', () => {
  it('returns no errors when customer, items, and billing email are all present', () => {
    expect(validateForSend(baseSendOrder)).toEqual([])
  })

  it('flags a missing customer', () => {
    expect(validateForSend({ ...baseSendOrder, customer: { id: '', name: '' } }))
      .toContain('A customer is required.')
  })

  it('flags an empty items array', () => {
    expect(validateForSend({ ...baseSendOrder, items: [] }))
      .toContain('At least one line item is required.')
  })

  it.each([
    [undefined],
    [''],
    ['   '],
  ])('flags a missing/blank billing email (%p)', (email) => {
    expect(validateForSend({ ...baseSendOrder, billing: { email } }))
      .toContain('A billing email is required to send this order.')
  })

  it('returns all applicable errors at once, not just the first', () => {
    const errors = validateForSend({ customer: { id: '', name: '' }, items: [], billing: { email: '' } })
    expect(errors).toHaveLength(3)
  })
})

// The Scheduled Installation Date is mandatory and future-only; the form
// field carries the guard, and the payload mapping round-trips it.
describe('scheduled installation date', () => {
  it('is a required date field that cannot be set in the past', () => {
    const field = PRIMARY_INFO_FIELDS.find((f) => f.key === 'scheduled_install_date')
    expect(field).toMatchObject({ label: 'Scheduled Installation Date', type: 'date', required: true, minDate: 'today' })
  })

  it('is sent as scheduledInstallDate', () => {
    const payload = toCreatePayload({ customer_uuid: 'c-1', scheduled_install_date: '2026-11-10' }, [])
    expect(payload.scheduledInstallDate).toBe('2026-11-10')
  })

  it('is sent blank, never undefined, when not chosen (the server then refuses it)', () => {
    expect(toCreatePayload({ customer_uuid: 'c-1' }, []).scheduledInstallDate).toBe('')
  })

  it('loads back into the form, blank for an order that predates the field', () => {
    const base = { salesOrderNumber: 'SO-1', status: 'Draft', orderDate: '2026-10-12', items: [], billing: {}, shipping: {},
      customer: { id: 'c-1', name: 'Acme' } } as unknown as SalesOrder
    expect(fromOrder({ ...base, scheduledInstallDate: '2026-11-10' }).data.scheduled_install_date).toBe('2026-11-10')
    expect(fromOrder(base).data.scheduled_install_date).toBe('')
  })
})
