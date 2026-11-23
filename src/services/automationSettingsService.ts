import { tenantClient } from '@/api/tenantClient';
import type { AutomationSettings } from '@/types/automationSettings';

// Workspace automation settings — GET /api/tenant/automation/settings
// (automation:read) and PUT (automation:configure, body {killSwitch}).

export const automationSettingsService = {
  get: (): Promise<AutomationSettings> =>
    tenantClient
      .get<{ success: boolean; settings: AutomationSettings }>('/tenant/automation/settings')
      .then((r) => r.data.settings),

  setKillSwitch: (killSwitch: boolean): Promise<AutomationSettings> =>
    tenantClient
      .put<{ success: boolean; settings: AutomationSettings }>('/tenant/automation/settings', { killSwitch })
      .then((r) => r.data.settings),
};
