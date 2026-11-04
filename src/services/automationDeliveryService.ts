import { tenantClient } from '@/api/tenantClient';
import type { AutomationDeliveryFilters, AutomationDeliveryPage } from '@/types/automationDelivery';

// Automated email log — GET /api/tenant/automation/deliveries (automation:read).
// Filters are status + ruleKey only; paging is keyset via the opaque nextCursor.

export const automationDeliveryService = {
  list: (filters: AutomationDeliveryFilters, cursor?: string): Promise<AutomationDeliveryPage> =>
    tenantClient
      .get<{ success: boolean; deliveries: AutomationDeliveryPage['deliveries'] | null; nextCursor: string | null }>(
        '/tenant/automation/deliveries',
        { params: { status: filters.status, ruleKey: filters.ruleKey, cursor: cursor || undefined } },
      )
      .then((r) => ({ deliveries: r.data.deliveries ?? [], nextCursor: r.data.nextCursor ?? '' })),
};
