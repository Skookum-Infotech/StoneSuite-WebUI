import { describe, it, expect } from 'vitest'
import { attentionKindLabel, attentionRowHref, formatAttentionDetail } from './purchasesStatus'
import type { PurchasesAttentionRow } from '@/types/dashboardData'

function makeRow(overrides: Partial<PurchasesAttentionRow> = {}): PurchasesAttentionRow {
  return {
    kind: 'purchase_order', id: 'po-1', recordNumber: 'PORD-000087', party: 'Apex Stone Supply',
    value: 6200, daysOverdue: null, daysWaiting: null,
    ...overrides,
  }
}

describe('formatAttentionDetail', () => {
  it('pluralizes days overdue', () => {
    expect(formatAttentionDetail(makeRow({ daysOverdue: 3 }))).toBe('3 days overdue')
  })

  it('uses singular phrasing for exactly one day overdue', () => {
    expect(formatAttentionDetail(makeRow({ daysOverdue: 1 }))).toBe('1 day overdue')
  })

  it('pluralizes days waiting', () => {
    expect(formatAttentionDetail(makeRow({ daysWaiting: 6 }))).toBe('waiting 6 days')
  })

  it('uses singular phrasing for exactly one day waiting', () => {
    expect(formatAttentionDetail(makeRow({ daysWaiting: 1 }))).toBe('waiting 1 day')
  })

  it('reads "less than a day" for a same-day pending row', () => {
    expect(formatAttentionDetail(makeRow({ daysWaiting: 0 }))).toBe('waiting less than a day')
  })
})

describe('attentionRowHref', () => {
  it('routes a purchase order row to the purchase order detail page', () => {
    expect(attentionRowHref(makeRow({ kind: 'purchase_order', id: 'po-9' }))).toBe('/purchases/purchase_order/po-9')
  })

  it('routes a requisition row to the requisition detail page', () => {
    expect(attentionRowHref(makeRow({ kind: 'requisition', id: 'reqn-9' }))).toBe('/purchases/requisition/reqn-9')
  })
})

describe('attentionKindLabel', () => {
  it('labels a purchase order row "PO"', () => {
    expect(attentionKindLabel(makeRow({ kind: 'purchase_order' }))).toBe('PO')
  })

  it('labels a requisition row "REQ"', () => {
    expect(attentionKindLabel(makeRow({ kind: 'requisition' }))).toBe('REQ')
  })
})
