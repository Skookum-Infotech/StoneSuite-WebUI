import { tenantClient } from '@/api/tenantClient';
import type { CompanyProfile } from '@/types/companyProfile';

export const companyProfileService = {
  // logoUrl is a short-TTL presigned R2 URL, not part of the profile record
  // itself — it rides alongside companyProfile in the same response so every
  // caller (settings page, header, PDF export) gets it from the one request.
  get: () =>
    tenantClient
      .get<{ success: boolean; companyProfile: CompanyProfile; logoUrl: string }>('/tenant/company-profile')
      .then((r) => ({ ...r.data.companyProfile, logoUrl: r.data.logoUrl })),
  update: (profile: CompanyProfile) =>
    tenantClient
      .put<{ success: boolean; companyProfile: CompanyProfile }>('/tenant/company-profile', profile)
      .then((r) => r.data.companyProfile),
  // Body is the raw image bytes, not JSON — the backend decodes/re-encodes
  // and stores it in the tenant's own R2 bucket (PUT /tenant/company-profile/logo).
  uploadLogo: (file: File): Promise<void> =>
    tenantClient
      .put<{ success: boolean }>('/tenant/company-profile/logo', file, {
        headers: { 'Content-Type': file.type },
      })
      .then(() => undefined),
  deleteLogo: (): Promise<void> =>
    tenantClient.delete<{ success: boolean }>('/tenant/company-profile/logo').then(() => undefined),
};
