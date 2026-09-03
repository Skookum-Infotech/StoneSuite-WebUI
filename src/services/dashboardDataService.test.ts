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

describe('dashboardDataService.getSalesOrdersSnapshot', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the range as a query param and returns the parsed payload', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true,
        range: '30d',
        openCount: 20,
        openValue: 412300,
        lateCount: 3,
        lateValue: 47250,
        statuses: [
          { code: 'DRFT', label: 'Draft', count: 3, value: 18400 },
          { code: 'OPEN', label: 'Open', count: 11, value: 240300 },
        ],
        atRisk: [
          { id: 'so-1', recordNumber: 'SO-1042', customer: 'Fontaine Builders', value: 28400, status: 'Open', daysLate: 12 },
        ],
      },
    })

    const result = await dashboardDataService.getSalesOrdersSnapshot('30d')

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/dashboard/widgets/sales-orders-snapshot/data', {
      params: { range: '30d' },
    })
    expect(result).toEqual({
      range: '30d',
      openCount: 20,
      openValue: 412300,
      lateCount: 3,
      lateValue: 47250,
      statuses: [
        { code: 'DRFT', label: 'Draft', count: 3, value: 18400 },
        { code: 'OPEN', label: 'Open', count: 11, value: 240300 },
      ],
      atRisk: [
        { id: 'so-1', recordNumber: 'SO-1042', customer: 'Fontaine Builders', value: 28400, status: 'Open', daysLate: 12 },
      ],
    })
  })

  it('defaults statuses/atRisk to empty arrays and counts/values to 0 when the backend omits them', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, range: 'all' },
    })

    const result = await dashboardDataService.getSalesOrdersSnapshot('all')

    expect(result.openCount).toBe(0)
    expect(result.openValue).toBe(0)
    expect(result.lateCount).toBe(0)
    expect(result.lateValue).toBe(0)
    expect(result.statuses).toEqual([])
    expect(result.atRisk).toEqual([])
  })
})

describe('dashboardDataService.getTopCustomers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the range as a query param and returns the parsed payload', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true,
        range: '30d',
        customers: [
          { id: 'cust-1', name: 'Fontaine Builders', value: 142300, priorValue: 120600 },
          { id: null, name: 'Sterling Kitchen & Bath', value: 96500, priorValue: null },
        ],
        totalValue: 638800,
        customerCount: 23,
      },
    })

    const result = await dashboardDataService.getTopCustomers('30d')

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/dashboard/widgets/top-customers/data', {
      params: { range: '30d' },
    })
    expect(result).toEqual({
      range: '30d',
      customers: [
        { id: 'cust-1', name: 'Fontaine Builders', value: 142300, priorValue: 120600 },
        { id: null, name: 'Sterling Kitchen & Bath', value: 96500, priorValue: null },
      ],
      totalValue: 638800,
      customerCount: 23,
    })
  })

  it('defaults customers to an empty array and totals to 0 when the backend omits them', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, range: 'all' },
    })

    const result = await dashboardDataService.getTopCustomers('all')

    expect(result.customers).toEqual([])
    expect(result.totalValue).toBe(0)
    expect(result.customerCount).toBe(0)
  })
})

describe('dashboardDataService.getInventoryAlerts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the range as a query param and returns the parsed payload', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true,
        range: 'all',
        alerts: [
          { id: 'item-1', itemName: 'Black Galaxy Slab', warehouse: 'Warehouse 1', onHand: 4, allocated: 10, reorderPoint: 0, severity: 'short' },
        ],
        alertCount: 7,
      },
    })

    const result = await dashboardDataService.getInventoryAlerts('all')

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/dashboard/widgets/inventory-alerts/data', {
      params: { range: 'all' },
    })
    expect(result).toEqual({
      range: 'all',
      alerts: [
        { id: 'item-1', itemName: 'Black Galaxy Slab', warehouse: 'Warehouse 1', onHand: 4, allocated: 10, reorderPoint: 0, severity: 'short' },
      ],
      alertCount: 7,
    })
  })

  it('defaults alerts to an empty array and alertCount to 0 when the backend omits them', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, range: 'all' },
    })

    const result = await dashboardDataService.getInventoryAlerts('all')

    expect(result.alerts).toEqual([])
    expect(result.alertCount).toBe(0)
  })
})

describe('dashboardDataService.getPurchasesStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the range as a query param and returns the parsed payload', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true,
        range: 'all',
        incoming: { count: 3, value: 4120 },
        overdue: { count: 1, value: 6200 },
        pending: { count: 2, value: 2250 },
        attention: [
          { kind: 'purchase_order', id: 'po-1', recordNumber: 'PORD-000087', party: 'Apex Stone Supply', value: 6200, daysOverdue: 3, daysWaiting: null },
        ],
        attentionCount: 3,
      },
    })

    const result = await dashboardDataService.getPurchasesStatus('all')

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/dashboard/widgets/purchases-status/data', {
      params: { range: 'all' },
    })
    expect(result).toEqual({
      range: 'all',
      incoming: { count: 3, value: 4120 },
      overdue: { count: 1, value: 6200 },
      pending: { count: 2, value: 2250 },
      attention: [
        { kind: 'purchase_order', id: 'po-1', recordNumber: 'PORD-000087', party: 'Apex Stone Supply', value: 6200, daysOverdue: 3, daysWaiting: null },
      ],
      attentionCount: 3,
    })
  })

  it('passes a null pending tile through unchanged (not applicable to this caller)', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true, range: 'all',
        incoming: { count: 0, value: 0 }, overdue: { count: 0, value: 0 }, pending: null,
      },
    })

    const result = await dashboardDataService.getPurchasesStatus('all')

    expect(result.pending).toBeNull()
  })

  it('defaults incoming/overdue to zero, pending to null, and attention to an empty array when the backend omits them', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, range: 'all' },
    })

    const result = await dashboardDataService.getPurchasesStatus('all')

    expect(result.incoming).toEqual({ count: 0, value: 0 })
    expect(result.overdue).toEqual({ count: 0, value: 0 })
    expect(result.pending).toBeNull()
    expect(result.attention).toEqual([])
    expect(result.attentionCount).toBe(0)
  })
})
