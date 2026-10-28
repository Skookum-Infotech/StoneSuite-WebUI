import { tenantClient } from '@/api/tenantClient';
import type { AutomationRule } from '@/types/automationRule';

// Workspace automation rules — GET /api/tenant/automation/rules (automation:read)
// and PUT /api/tenant/automation/rules/{key} (automation:configure, body
// {enabled}). Today the UI only drives the anomaly scan's on/off switch.

export const automationRuleService = {
  list: (): Promise<AutomationRule[]> =>
    tenantClient
      .get<{ success: boolean; rules: AutomationRule[] | null }>('/tenant/automation/rules')
      .then((r) => r.data.rules ?? []),

  setEnabled: (key: string, enabled: boolean): Promise<AutomationRule> =>
    tenantClient
      .put<{ success: boolean; rule: AutomationRule }>(`/tenant/automation/rules/${key}`, { enabled })
      .then((r) => r.data.rule),
};
