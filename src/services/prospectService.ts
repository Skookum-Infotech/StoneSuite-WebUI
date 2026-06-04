// Prospect service — calls the dedicated /api/tenant/prospects REST endpoints
// backed by the per-tenant `prospects` table (migration 000004). All form
// field values are stored as typed columns, not generic JSONB.
import { tenantClient } from '@/api/tenantClient';
import type { Prospect } from '@/types/prospect';

export type { Prospect };

export const prospectService = {
  list: (): Promise<Prospect[]> =>
    tenantClient
      .get<{ success: boolean; prospects: Prospect[] }>('/tenant/prospects')
      .then((r) => r.data.prospects),

  get: (id: string): Promise<Prospect> =>
    tenantClient
      .get<{ success: boolean; prospect: Prospect }>(`/tenant/prospects/${id}`)
      .then((r) => r.data.prospect),

  create: (fields: Record<string, unknown>): Promise<Prospect> =>
    tenantClient
      .post<{ success: boolean; prospect: Prospect }>('/tenant/prospects', fields)
      .then((r) => r.data.prospect),

  update: (id: string, fields: Record<string, unknown>): Promise<Prospect> =>
    tenantClient
      .patch<{ success: boolean; prospect: Prospect }>(`/tenant/prospects/${id}`, fields)
      .then((r) => r.data.prospect),

  delete: (id: string): Promise<void> =>
    tenantClient.delete(`/tenant/prospects/${id}`).then(() => undefined),
};
