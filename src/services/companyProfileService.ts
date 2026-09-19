import { tenantClient } from '@/api/tenantClient';
import type { CompanyProfile } from '@/types/companyProfile';

// PNG/JPEG only, 2MB cap -- mirrors the backend's decodeLogoAsPNG
// (controllers/company_profile.go). Enforced here too for fast client-side
// feedback; the backend re-validates regardless, since it never trusts a
// client-declared type/size.
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg'];

export const companyProfileService = {
  get: () =>
    tenantClient
      .get<{ success: boolean; companyProfile: CompanyProfile }>('/tenant/company-profile')
      .then((r) => r.data.companyProfile),
  update: (profile: CompanyProfile) =>
    tenantClient
      .put<{ success: boolean; companyProfile: CompanyProfile }>('/tenant/company-profile', profile)
      .then((r) => r.data.companyProfile),
  /** Same GET as `get`, read for just its `logoUrl` (a short-TTL presigned
   *  preview URL, '' when no logo is set) -- kept as its own query so
   *  CompanyLogoCard doesn't force every other `['company-profile']`
   *  consumer (LocationsTab, AddPurchaseOrderPage) to learn a new response
   *  shape for a field only it needs. */
  getLogoUrl: (): Promise<string> =>
    tenantClient
      .get<{ success: boolean; logoUrl?: string }>('/tenant/company-profile')
      .then((r) => r.data.logoUrl ?? ''),
  uploadLogo: (file: File): Promise<void> =>
    tenantClient
      .put('/tenant/company-profile/logo', file, { headers: { 'Content-Type': file.type } })
      .then(() => undefined),
  deleteLogo: (): Promise<void> =>
    tenantClient.delete('/tenant/company-profile/logo').then(() => undefined),
};
