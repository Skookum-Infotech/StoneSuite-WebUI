import { tenantClient } from '@/api/tenantClient';
import type { CompanyLocation } from '@/types/companyProfile';
import type { CompanyLocationFormValues } from '@/lib/companyLocationForm';

export const companyLocationService = {
  list: () =>
    tenantClient
      .get<{ success: boolean; locations: CompanyLocation[] }>('/tenant/company-locations')
      .then((r) => r.data.locations),
  create: (input: CompanyLocationFormValues) =>
    tenantClient
      .post<{ success: boolean; location: CompanyLocation }>('/tenant/company-locations', input)
      .then((r) => r.data.location),
  update: (id: string, input: CompanyLocationFormValues) =>
    tenantClient
      .patch<{ success: boolean }>(`/tenant/company-locations/${id}`, input)
      .then(() => undefined),
  remove: (id: string) =>
    tenantClient.delete<{ success: boolean }>(`/tenant/company-locations/${id}`).then(() => undefined),
  setDefault: (id: string) =>
    tenantClient
      .post<{ success: boolean }>(`/tenant/company-locations/${id}/default`)
      .then(() => undefined),
};
