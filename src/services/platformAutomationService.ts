import { AxiosError } from 'axios';
import { tenantClient } from '@/api/tenantClient';
import type { PlatformAutomationSettings } from '@/types/ai';

type AutomationResponse = { success: boolean } & PlatformAutomationSettings;

const HTTP_BAD_GATEWAY = 502;

/** Platform-admin: current state of the automation scheduler switch. */
export function getPlatformAutomation(): Promise<PlatformAutomationSettings> {
  return tenantClient.get<AutomationResponse>('/platform/automation').then((r) => r.data);
}

/** Platform-admin: flip the switch. A 502 means the database saved the change
 *  but the Cloudflare mirror failed — the body still carries the saved state
 *  (kvSynced=false), so it is returned rather than thrown; the page shows a
 *  retry prompt. */
export function setPlatformAutomationEnabled(enabled: boolean): Promise<PlatformAutomationSettings> {
  return tenantClient
    .put<AutomationResponse>('/platform/automation', { enabled })
    .then((r) => r.data)
    .catch((err: unknown) => {
      if (err instanceof AxiosError && err.response?.status === HTTP_BAD_GATEWAY && err.response.data) {
        return err.response.data as AutomationResponse;
      }
      throw err;
    });
}
