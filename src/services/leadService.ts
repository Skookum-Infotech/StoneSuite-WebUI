import { tenantClient } from '@/api/tenantClient';
import type { Lead, CreateLeadPayload } from '@/types/lead';

export type { Lead };

export const leadService = {
  list: (): Promise<Lead[]> =>
    tenantClient
      .get<{ success: boolean; leads: Lead[] }>('/tenant/leads')
      .then((r) => r.data.leads ?? []),

  get: (id: string): Promise<Lead> =>
    tenantClient
      .get<{ success: boolean; lead: Lead }>(`/tenant/leads/${id}`)
      .then((r) => r.data.lead),

  create: (payload: CreateLeadPayload): Promise<Lead> =>
    tenantClient
      .post<{ success: boolean; lead: Lead }>('/tenant/leads', payload)
      .then((r) => r.data.lead),

  update: (id: string, payload: Partial<CreateLeadPayload>): Promise<Lead> =>
    tenantClient
      .patch<{ success: boolean; lead: Lead }>(`/tenant/leads/${id}`, payload)
      .then((r) => r.data.lead),

  delete: (id: string): Promise<void> =>
    tenantClient.delete(`/tenant/leads/${id}`).then(() => undefined),
};
