import { tenantClient } from '@/api/tenantClient';
import type { SubscriptionUsage } from '@/types/subscription';

export const subscriptionService = {
  // The caller's own tenant's R2 storage + LLM tokens for the current billing
  // period. Takes no tenant/bucket params — the backend resolves the tenant
  // from the JWT.
  getUsage: (): Promise<SubscriptionUsage> =>
    tenantClient
      .get<{ success: boolean; usage: SubscriptionUsage }>('/tenant/subscription/usage')
      .then((r) => r.data.usage),
};
