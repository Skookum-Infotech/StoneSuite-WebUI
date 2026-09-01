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
