import { describe, it, expect } from 'vitest'
import { ESTIMATE_CONVERTIBLE_STATUSES, toCreatePayload } from './estimateForm'

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
