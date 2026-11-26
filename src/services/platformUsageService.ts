import { AxiosError } from 'axios';
import { tenantClient } from '@/api/tenantClient';
import { mockAckAlert, mockOverview, mockTenantUsage, mockWatchlist } from '@/lib/platformUsageMock';
import type {
  SnoozeDays,
  TenantUsageDetail,
  TenantUsageRow,
  UsageAlert,
  UsageOverview,
  UsagePeriod,
} from '@/types/platformUsage';

/** True when the build serves sample data instead of calling the backend
 *  (VITE_PLATFORM_USAGE_MOCK=true, until /platform/usage ships). */
export const PLATFORM_USAGE_MOCK = import.meta.env.VITE_PLATFORM_USAGE_MOCK === 'true';

// The overview is fetched a page at a time and stitched together, the same
// way platformService.listTenants does. The cursor is the server's opaque
// value, passed back untouched.
const OVERVIEW_PAGE_SIZE = 200;
const MAX_OVERVIEW_PAGES = 500;
const HTTP_NOT_FOUND = 404;

type OverviewPage = Omit<UsageOverview, 'tenants'> & { success: boolean; tenants: TenantUsageRow[]; nextCursor?: string };

/** Thrown by getTenantUsage on a 404, which also covers a tenant that exists
 *  but isn't visible to the caller, so the page never says which. */
export class UsageNotAvailableError extends Error {
  constructor() {
    super('Usage is not available for this tenant.');
    this.name = 'UsageNotAvailableError';
  }
}

export const platformUsageService = {
  /** Fleet totals plus one row per tenant for the period. */
  getOverview: async (period: UsagePeriod): Promise<UsageOverview> => {
    if (PLATFORM_USAGE_MOCK) return mockOverview(period);
    let first: OverviewPage | null = null;
    const tenants: TenantUsageRow[] = [];
    let cursor = '';
    for (let page = 0; page < MAX_OVERVIEW_PAGES; page += 1) {
      const { data } = await tenantClient.get<OverviewPage>('/platform/usage/overview', {
        params: { period, limit: OVERVIEW_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
      });
      first ??= data;
      tenants.push(...(data.tenants ?? []));
      cursor = data.nextCursor ?? '';
      if (!cursor) break;
    }
    if (!first) throw new Error('Usage overview returned no data.');
    return { generatedAt: first.generatedAt, period: first.period, fleet: first.fleet, tenants };
  },

  /** Open alerts across every tenant (the watch list). */
  getWatchlist: async (): Promise<UsageAlert[]> => {
    if (PLATFORM_USAGE_MOCK) return mockWatchlist();
    const { data } = await tenantClient.get<{ success: boolean; alerts: UsageAlert[] }>('/platform/usage/watchlist');
    return data.alerts ?? [];
  },

  /** One tenant's metrics, daily series, largest tables, activity and alert history. */
  getTenantUsage: async (tenantId: string, period: UsagePeriod): Promise<TenantUsageDetail> => {
    if (PLATFORM_USAGE_MOCK) {
      const detail = mockTenantUsage(tenantId, period);
      if (!detail) throw new UsageNotAvailableError();
      return detail;
    }
    try {
      const { data } = await tenantClient.get<{ success: boolean } & TenantUsageDetail>(
        `/platform/usage/tenants/${encodeURIComponent(tenantId)}`,
        { params: { period } },
      );
      return data;
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.status === HTTP_NOT_FOUND) throw new UsageNotAvailableError();
      throw err;
    }
  },

  /** Acknowledge an alert, or snooze it for 7 or 30 days. */
  ackAlert: async (alertId: string, snoozeDays?: SnoozeDays): Promise<void> => {
    if (PLATFORM_USAGE_MOCK) {
      if (!mockAckAlert(alertId, snoozeDays)) throw new Error('Alert not found.');
      return;
    }
    await tenantClient.post(`/platform/usage/alerts/${encodeURIComponent(alertId)}/ack`, snoozeDays ? { snoozeDays } : {});
  },
};
