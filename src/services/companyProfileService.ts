import { tenantClient } from '@/api/tenantClient';
import type { CompanyProfile } from '@/types/companyProfile';

export const companyProfileService = {
  get: () =>
    tenantClient
      .get<{ success: boolean; companyProfile: CompanyProfile }>('/tenant/company-profile')
      .then((r) => r.data.companyProfile),
  update: (profile: CompanyProfile) =>
    tenantClient
      .put<{ success: boolean; companyProfile: CompanyProfile }>('/tenant/company-profile', profile)
      .then((r) => r.data.companyProfile),
};
