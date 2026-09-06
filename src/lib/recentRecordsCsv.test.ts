import { describe, it, expect } from 'vitest'
import { recentRecordsToCsvRows } from './recentRecordsCsv'
import type { RecentRecord } from '@/types/dashboardData'

function makeRecord(overrides: Partial<RecentRecord> = {}): RecentRecord {
  return {
    id: 'so-1', module: 'sales_order', domain: 'sales', recordNumber: 'SO-1042',
    account: 'Fontaine Builders', value: 28400, status: 'Fabrication', updatedAt: '2026-09-02T14:00:00Z',
    ...overrides,
  }
}

describe('recentRecordsToCsvRows', () => {
  it('maps a record to a human-labeled CSV row', () => {
    const rows = recentRecordsToCsvRows([makeRecord()])
    expect(rows).toEqual([['Sales Order', 'SO-1042', 'Fontaine Builders', '28400', 'Fabrication', '2026-09-02T14:00:00Z']])
  })

  it('renders a null account as an empty cell, not "null"', () => {
    const rows = recentRecordsToCsvRows([makeRecord({ account: null })])
    expect(rows[0][2]).toBe('')
  })

  it('renders a null value as an empty cell, not "null" or "0"', () => {
    const rows = recentRecordsToCsvRows([makeRecord({ value: null })])
    expect(rows[0][3]).toBe('')
  })

  it('maps an empty list to an empty row list', () => {
    expect(recentRecordsToCsvRows([])).toEqual([])
  })
})
