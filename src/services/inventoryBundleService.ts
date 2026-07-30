import { tenantClient } from '@/api/tenantClient';
import type { Bundle, BundleInput, BundleMemberInput, MoveBundleInput, InventoryUnit } from '@/types/inventory';

// Bundles — pallets of slabs banded together, `inventory_bundle` RBAC
// resource. Lifecycle open -> sealed -> broken (terminal). PATCH /{uuid} is
// NOT full-overwrite for inventoryItemId/binId: omitting them leaves them
// untouched (the server sets both itself); send "" to clear. Every other
// field on BundleInput is written as sent. List is NOT keyset-paginated —
// it returns every matching bundle at once.
const BASE = '/tenant/inventory/bundles';

export const inventoryBundleService = {
  listBundles: (warehouseId?: string, status?: string): Promise<Bundle[]> =>
    tenantClient
      .get<{ success: boolean; records: Bundle[] }>(BASE, {
        params: { ...(warehouseId ? { warehouseId } : {}), ...(status ? { status } : {}) },
      })
      .then((r) => r.data.records ?? []),

  getBundle: (uuid: string): Promise<Bundle> =>
    tenantClient.get<{ success: boolean; bundle: Bundle }>(`${BASE}/${uuid}`).then((r) => r.data.bundle),

  // memberIds optionally seeds membership at creation.
  createBundle: (payload: BundleInput): Promise<Bundle> =>
    tenantClient.post<{ success: boolean; bundle: Bundle }>(BASE, payload).then((r) => r.data.bundle),

  updateBundle: (uuid: string, payload: BundleInput): Promise<Bundle> =>
    tenantClient.patch<{ success: boolean; bundle: Bundle }>(`${BASE}/${uuid}`, payload).then((r) => r.data.bundle),

  deleteBundle: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  getMembers: (uuid: string): Promise<InventoryUnit[]> =>
    tenantClient
      .get<{ success: boolean; records: InventoryUnit[] }>(`${BASE}/${uuid}/members`)
      .then((r) => r.data.records ?? []),

  // First member fixes the bundle's item; later members must match.
  addMembers: (uuid: string, payload: BundleMemberInput): Promise<Bundle> =>
    tenantClient
      .post<{ success: boolean; bundle: Bundle }>(`${BASE}/${uuid}/members`, payload)
      .then((r) => r.data.bundle),

  removeMembers: (uuid: string, payload: BundleMemberInput): Promise<Bundle> =>
    tenantClient
      .delete<{ success: boolean; bundle: Bundle }>(`${BASE}/${uuid}/members`, { data: payload })
      .then((r) => r.data.bundle),

  // Freezes membership — members then move only via the bundle.
  seal: (uuid: string): Promise<Bundle> =>
    tenantClient.post<{ success: boolean; bundle: Bundle }>(`${BASE}/${uuid}/seal`, {}).then((r) => r.data.bundle),

  // Terminal — the band code freezes onto every member as provenance.
  // Re-banding means creating a new bundle.
  break: (uuid: string): Promise<Bundle> =>
    tenantClient.post<{ success: boolean; bundle: Bundle }>(`${BASE}/${uuid}/break`, {}).then((r) => r.data.bundle),

  // The only way to move a sealed bundle — moves the pallet and every unit on it.
  moveBin: (uuid: string, payload: MoveBundleInput): Promise<Bundle> =>
    tenantClient
      .patch<{ success: boolean; bundle: Bundle }>(`${BASE}/${uuid}/bin`, payload)
      .then((r) => r.data.bundle),
};
