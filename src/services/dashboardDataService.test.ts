import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import { tenantClient } from '@/api/tenantClient'
import { dashboardDataService } from './dashboardDataService'

describe('dashboardDataService.getPipelineMix', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the range as a query param and returns the parsed payload', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true,
        range: '30d',
        segments: [
          { id: 'lead', count: 24 },
          { id: 'prospect', count: 17 },
          { id: 'customer', count: 9 },
        ],
        closeRate: 18,
      },
    })

    const result = await dashboardDataService.getPipelineMix('30d')

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/dashboard/widgets/pipeline-donut/data', {
      params: { range: '30d' },
    })
    expect(result).toEqual({
      range: '30d',
      segments: [
        { id: 'lead', count: 24 },
        { id: 'prospect', count: 17 },
        { id: 'customer', count: 9 },
      ],
      closeRate: 18,
    })
  })

  it('defaults segments to an empty array when the backend omits it', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, range: 'all', closeRate: 0 },
    })

    const result = await dashboardDataService.getPipelineMix('all')

    expect(result.segments).toEqual([])
  })
})

describe('dashboardDataService.getKpiStrip', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the range as a query param and returns the parsed payload', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true,
        range: '30d',
        metrics: [
          { id: 'revenue', value: 184250, deltaPct: 18, sparkline: [58, 64, 60, 74, 70, 86, 92] },
          { id: 'open-leads', value: 24, deltaCount: 6, sparkline: [59, 62, 58, 72, 71, 82, 88] },
          { id: 'sales-orders-fabrication', value: 12, subLabel: '4 in fabrication' },
          { id: 'needs-approval', value: 5, subLabel: 'oldest 2 days', oldestDays: 2 },
        ],
      },
    })

    const result = await dashboardDataService.getKpiStrip('30d')

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/dashboard/widgets/kpi-strip/data', {
      params: { range: '30d' },
    })
    expect(result.range).toBe('30d')
    expect(result.metrics).toHaveLength(4)
    expect(result.metrics[0]).toEqual({ id: 'revenue', value: 184250, deltaPct: 18, sparkline: [58, 64, 60, 74, 70, 86, 92] })
  })

  it('defaults metrics to an empty array when the backend omits it', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, range: 'all' },
    })

    const result = await dashboardDataService.getKpiStrip('all')

    expect(result.metrics).toEqual([])
  })
})

describe('dashboardDataService.getRecentRecords', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the range as a query param and returns the parsed payload', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true,
        range: '30d',
        records: [
          {
            id: 'so-1', module: 'sales_order', domain: 'sales', recordNumber: 'SO-1042',
            account: 'Fontaine Builders', value: 28400, status: 'Fabrication', updatedAt: '2026-09-02T14:32:11Z',
          },
        ],
        hasMore: true,
      },
    })

    const result = await dashboardDataService.getRecentRecords('30d')

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/dashboard/widgets/recent-records/data', {
      params: { range: '30d' },
    })
    expect(result).toEqual({
      range: '30d',
      hasMore: true,
      records: [
        {
          id: 'so-1', module: 'sales_order', domain: 'sales', recordNumber: 'SO-1042',
          account: 'Fontaine Builders', value: 28400, status: 'Fabrication', updatedAt: '2026-09-02T14:32:11Z',
        },
      ],
    })
  })

  it('defaults records to an empty array and hasMore to false when the backend omits them', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, range: 'all' },
    })

    const result = await dashboardDataService.getRecentRecords('all')

    expect(result.records).toEqual([])
    expect(result.hasMore).toBe(false)
  })
})
