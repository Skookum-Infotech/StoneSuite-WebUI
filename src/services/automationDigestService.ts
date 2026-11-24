import { tenantClient } from '@/api/tenantClient';
import type { DigestPrefs } from '@/types/automationDigest';

// The caller's own daily digest preferences. Self-service: login + tenant only, no id in the request.
export const automationDigestService = {
  get: (): Promise<DigestPrefs> =>
    tenantClient
      .get<{ success: boolean; preferences: DigestPrefs }>('/tenant/automation/digest/me')
      .then((r) => r.data.preferences),

  save: (prefs: DigestPrefs): Promise<DigestPrefs> =>
    tenantClient
      .put<{ success: boolean; preferences: DigestPrefs }>('/tenant/automation/digest/me', prefs)
      .then((r) => r.data.preferences),
};
