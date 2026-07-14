import { tenantClient } from '@/api/tenantClient';
import type { AuditEntry } from '@/services/crmService';
import type {
  Vendor, VendorCreatePayload, VendorUpdatePayload, VendorSearchRequest, VendorPage,
} from '@/types/vendor';

// Vendor module API wrapper. Talks to the dedicated relational module under
// `/api/tenant/vendors*` (NOT the generic `/api/tenant/crm/*` JSONB router) —
// mirrors salesOrderService.ts. Every call carries the tenant Bearer JWT via
// `tenantClient`; the server enforces tenancy, RBAC (`vendor:*`), scope, and
// IDOR.
const BASE = '/tenant/vendors';

export const vendorService = {
  // Full filter + sort + global search + keyset pagination.
  // Cursors are opaque — pass back what the server returned, never construct one.
  searchVendors: (req: VendorSearchRequest): Promise<VendorPage> =>
    tenantClient
      .post<{
        success: boolean; scope: string; records: Vendor[];
        nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
        scope: r.data.scope ?? '',
      })),

  getVendor: (uuid: string): Promise<Vendor> =>
    tenantClient
      .get<{ success: boolean; vendor: Vendor }>(`${BASE}/${uuid}`)
      .then((r) => r.data.vendor),

  createVendor: (payload: VendorCreatePayload): Promise<Vendor> =>
    tenantClient
      .post<{ success: boolean; vendor: Vendor }>(BASE, payload)
      .then((r) => r.data.vendor),

  updateVendor: (uuid: string, payload: VendorUpdatePayload): Promise<Vendor> =>
    tenantClient
      .patch<{ success: boolean; vendor: Vendor }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.vendor),

  deleteVendor: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  // Status change validated against the server-side transition map; a denied
  // move returns 409 (surface as a blocked-transition message, not a failure).
  transition: (uuid: string, toStatusCode: string): Promise<Vendor> =>
    tenantClient
      .post<{ success: boolean; vendor: Vendor }>(`${BASE}/${uuid}/transition`, { toStatusCode })
      .then((r) => r.data.vendor),

  getAudit: (uuid: string): Promise<AuditEntry[]> =>
    tenantClient
      .get<{ success: boolean; recordId: string; audit: AuditEntry[] }>(`${BASE}/${uuid}/audit`)
      .then((r) => r.data.audit ?? []),
};
