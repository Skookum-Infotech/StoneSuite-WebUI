import { tenantClient } from '@/api/tenantClient';
import type { AutomationRule, AutomationRuleInput } from '@/types/automationRule';
import type { AutomationPreview } from '@/types/automationPreview';

// Workspace automation rules — GET /api/tenant/automation/rules (automation:read)
// and PUT /api/tenant/automation/rules/{key} (automation:configure, body
// {enabled}), plus POST .../{key}/preview (automation:read) for a dry run.

export const automationRuleService = {
  list: (): Promise<AutomationRule[]> =>
    tenantClient
      .get<{ success: boolean; rules: AutomationRule[] | null }>('/tenant/automation/rules')
      .then((r) => r.data.rules ?? []),

  /** automation:configure. New rules start switched off. */
  create: (input: AutomationRuleInput): Promise<AutomationRule> =>
    tenantClient
      .post<{ success: boolean; rule: AutomationRule }>('/tenant/automation/rules', input)
      .then((r) => r.data.rule),

  setEnabled: (key: string, enabled: boolean): Promise<AutomationRule> =>
    tenantClient
      .put<{ success: boolean; rule: AutomationRule }>(`/tenant/automation/rules/${key}`, { enabled })
      .then((r) => r.data.rule),

  preview: (key: string): Promise<AutomationPreview> =>
    tenantClient
      .post<{ success: boolean } & AutomationPreview>(`/tenant/automation/rules/${key}/preview`)
      .then((r) => ({ counts: r.data.counts ?? {}, recipients: r.data.recipients ?? [] })),
};
