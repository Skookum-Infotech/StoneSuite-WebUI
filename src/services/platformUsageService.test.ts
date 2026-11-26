import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { UsageNotAvailableError, platformUsageService } from './platformUsageService';

const FLEET = {
  activeTenants: 1, totalTenants: 2, computeHours: 1, computeHoursPrev: 1, dbBytes: 1, dbBytesPrev: 1,
  r2Bytes: 1, r2BytesPrev: 1, aiTokens: 1, aiTokensPrev: 1, computeTrend: [],
};

function axiosStatus(status: number): AxiosError {
  return new AxiosError('fail', 'ERR', undefined, undefined, {
    status, statusText: '', headers: {}, config: { headers: new AxiosHeaders() }, data: {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('platformUsageService.getOverview', () => {
  it('stitches every page, passing the server cursor back untouched', async () => {
    vi.mocked(tenantClient.get)
      .mockResolvedValueOnce({ data: { success: true, generatedAt: 'g', period: '7d', fleet: FLEET, tenants: [{ tenantId: 'a' }], nextCursor: 'opaque==' } })
      .mockResolvedValueOnce({ data: { success: true, generatedAt: 'g2', period: '7d', fleet: FLEET, tenants: [{ tenantId: 'b' }] } });

    const out = await platformUsageService.getOverview('7d');

    expect(out.tenants.map((t) => t.tenantId)).toEqual(['a', 'b']);
    expect(out.generatedAt).toBe('g');
    expect(out.fleet).toEqual(FLEET);
    expect(tenantClient.get).toHaveBeenNthCalledWith(1, '/platform/usage/overview', { params: { period: '7d', limit: 200 } });
    expect(tenantClient.get).toHaveBeenNthCalledWith(2, '/platform/usage/overview', { params: { period: '7d', limit: 200, cursor: 'opaque==' } });
  });
});

describe('platformUsageService.getWatchlist', () => {
  it('unwraps the alerts and treats a missing list as empty', async () => {
    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { success: true, alerts: [{ id: 'x' }] } });
    expect(await platformUsageService.getWatchlist()).toEqual([{ id: 'x' }]);
    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { success: true } });
    expect(await platformUsageService.getWatchlist()).toEqual([]);
  });
});

describe('platformUsageService.getTenantUsage', () => {
  it('requests the tenant and period', async () => {
    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { success: true, period: '90d' } });
    await platformUsageService.getTenantUsage('t/1', '90d');
    expect(tenantClient.get).toHaveBeenCalledWith('/platform/usage/tenants/t%2F1', { params: { period: '90d' } });
  });

  it('turns a 404 into UsageNotAvailableError', async () => {
    vi.mocked(tenantClient.get).mockRejectedValueOnce(axiosStatus(404));
    await expect(platformUsageService.getTenantUsage('t-1', '30d')).rejects.toBeInstanceOf(UsageNotAvailableError);
  });

  it('rethrows other errors as they are', async () => {
    const err = axiosStatus(500);
    vi.mocked(tenantClient.get).mockRejectedValueOnce(err);
    await expect(platformUsageService.getTenantUsage('t-1', '30d')).rejects.toBe(err);
  });
});

describe('platformUsageService.ackAlert', () => {
  it.each([
    [undefined, {}],
    [7, { snoozeDays: 7 }],
    [30, { snoozeDays: 30 }],
  ] as const)('snoozeDays %s posts %j', async (snoozeDays, body) => {
    vi.mocked(tenantClient.post).mockResolvedValueOnce({ data: { success: true } });
    await platformUsageService.ackAlert('a-1', snoozeDays);
    expect(tenantClient.post).toHaveBeenCalledWith('/platform/usage/alerts/a-1/ack', body);
  });
});
