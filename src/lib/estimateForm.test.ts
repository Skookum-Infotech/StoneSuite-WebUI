import { describe, it, expect } from 'vitest'
import { ESTIMATE_CONVERTIBLE_STATUSES, toCreatePayload, validateForSend } from './estimateForm'
import type { Estimate } from '@/types/estimate'

describe('ESTIMATE_CONVERTIBLE_STATUSES', () => {
  it.each([
    ['DRFT', false],
    ['PAPV', false],
    ['APPV', true],
    ['SENT', true],
    ['RJCT', false],
    ['EXPR', false],
    ['CANC', false],
  ])('has(%p) -> %p', (code, expected) => {
    expect(ESTIMATE_CONVERTIBLE_STATUSES.has(code)).toBe(expected)
  })
})

describe('toCreatePayload line item description mapping', () => {
  const baseData: Record<string, unknown> = { customer_uuid: 'cust-1', ship_same_as_bill: true }

  it('sends no description for a catalog-picked line with no override', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'a', lineNo: 1, itemName: 'Widget', itemDescription: '', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00', inventoryItemUuid: 'inv-1' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, inventoryItemUuid: 'inv-1', quantity: 1, unitPrice: 10, discountPercent: 0 },
    ])
  })

  it('sends an explicit itemDescription for a catalog-picked line, overriding the catalog item', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'b', lineNo: 1, itemName: 'Widget', itemDescription: 'Blue widget, medium', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00', inventoryItemUuid: 'inv-1' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, inventoryItemUuid: 'inv-1', description: 'Blue widget, medium', quantity: 1, unitPrice: 10, discountPercent: 0 },
    ])
  })

  it('falls back to itemName as the description on a free-text line with no explicit description', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'c', lineNo: 1, itemName: 'Custom labor', itemDescription: '', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, description: 'Custom labor', quantity: 1, unitPrice: 10, discountPercent: 0 },
    ])
  })

  it('prefers an explicit itemDescription over itemName for a free-text line', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'd', lineNo: 1, itemName: 'Custom labor', itemDescription: 'Installation and setup', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, description: 'Installation and setup', quantity: 1, unitPrice: 10, discountPercent: 0 },
    ])
  })

  it('falls back to itemName when itemDescription is blank/whitespace-only on a free-text line', () => {
    const payload = toCreatePayload(baseData, [
      { id: 'e', lineNo: 1, itemName: 'Custom labor', itemDescription: '   ', quantity: '1', unitPrice: '10', discount: '0', amount: '10.00', total: '10.00' },
    ])
    expect(payload.items).toEqual([
      { lineNumber: 1, description: 'Custom labor', quantity: 1, unitPrice: 10, discountPercent: 0 },
    ])
  })
})

// validateForSend gates the Estimate detail page's "Send to Customer" quick
// action — see EstimateDetailPage's handleSendClick. The billing email check
// mirrors the backend's own requirement (the generic /document/send route
// 400s "At least one recipient is required" when billing.email is blank and
// no `to` override is supplied).
const baseSendEstimate: Pick<Estimate, 'customer' | 'items' | 'billing'> = {
  customer: { id: 'cust-1', name: 'Acme Co' },
  items: [{
    id: 'line-1', lineNumber: 1, sku: '', itemName: 'Item', description: '',
    unitCode: '', quantity: 1, unitPrice: 10, discountPercent: 0, taxPercent: 0,
    lineSubtotal: 10, lineDiscount: 0, lineTax: 0, lineTotal: 10,
  }],
  billing: { email: 'billing@acme.test' },
}

describe('validateForSend', () => {
  it('returns no errors when customer, items, and billing email are all present', () => {
    expect(validateForSend(baseSendEstimate)).toEqual([])
  })

  it('flags a missing customer', () => {
    expect(validateForSend({ ...baseSendEstimate, customer: { id: '', name: '' } }))
      .toContain('A customer is required.')
  })

  it('flags an empty items array', () => {
    expect(validateForSend({ ...baseSendEstimate, items: [] }))
      .toContain('At least one line item is required.')
  })

  it.each([
    [undefined],
    [''],
    ['   '],
  ])('flags a missing/blank billing email (%p)', (email) => {
    expect(validateForSend({ ...baseSendEstimate, billing: { email } }))
      .toContain('A billing email is required to send this estimate.')
  })

  it('returns all applicable errors at once, not just the first', () => {
    const errors = validateForSend({ customer: { id: '', name: '' }, items: [], billing: { email: '' } })
    expect(errors).toHaveLength(3)
  })
})
