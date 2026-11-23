import { tenantClient } from '@/api/tenantClient';
import type {
  InventoryUnit, UnitPage, UnitSearchRequest,
  ScrapUnitInput, CutUnitInput, CutResult, UnitHistoryEntry, ReserveUnitInput,
} from '@/types/inventory';

// Physical units — slabs and remnants — `inventory_unit` RBAC resource.
// Legacy `/inventory/slabs/*` paths are served by the same backend handlers;
// this service only uses the current `/inventory/units/*` paths.
//
// There is deliberately no create call: a new unit enters inventory only by
// posting an item receipt against a purchase order (itemReceiptService).
const BASE = '/tenant/inventory/units';

export const inventoryUnitService = {
  inspect: (id: string, input: { decision: 'accepted' | 'rejected'; reason: string }) => tenantClient.post(`${BASE}/${id}/inspection`, input),
  searchUnits: (req: UnitSearchRequest): Promise<UnitPage> =>
    tenantClient
      .post<{ success: boolean; records: InventoryUnit[]; nextCursor: string; hasMore: boolean }>(
        `${BASE}/search`, req,
      )
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  // Largest usable remnant first — the shape a "what can I use for this
  // countertop" search wants.
  listRemnants: (itemId: string, minArea?: number): Promise<InventoryUnit[]> =>
    tenantClient
      .get<{ success: boolean; records: InventoryUnit[] }>(`${BASE}/remnants`, {
        params: { itemId, ...(minArea ? { minArea } : {}) },
      })
      .then((r) => r.data.records ?? []),

  getUnit: (uuid: string): Promise<InventoryUnit> =>
    tenantClient
      .get<{ success: boolean; unit: InventoryUnit }>(`${BASE}/${uuid}`)
      .then((r) => r.data.unit),

  // There is deliberately no moveBin: a slab is moved between bins with a Bin
  // Transfer (binTransferService), which can be approved and leaves a document.
  // The server refuses the old instant PATCH .../bin.

  scrap: (uuid: string, payload: ScrapUnitInput): Promise<InventoryUnit> =>
    tenantClient
      .post<{ success: boolean; unit: InventoryUnit }>(`${BASE}/${uuid}/scrap`, payload)
      .then((r) => r.data.unit),

  // Hold an available slab for a customer, with no sales order or job; release
  // gives it back. Only a reservation made this way can be released this way.
  reserve: (uuid: string, payload: ReserveUnitInput) =>
    tenantClient.post(`${BASE}/${uuid}/reserve`, payload).then((r) => r.data),

  release: (uuid: string, note?: string) =>
    tenantClient.post(`${BASE}/${uuid}/release`, { note }).then((r) => r.data),

  cut: (uuid: string, payload: CutUnitInput): Promise<CutResult> =>
    tenantClient
      .post<{ success: boolean; result: CutResult }>(`${BASE}/${uuid}/cut`, payload)
      .then((r) => r.data.result),

  // The picture of one slab. The URL is a short-lived presigned R2 link ('' when
  // the slab has no photo); the body of an upload is the raw image bytes, not JSON.
  getPhotoUrl: (uuid: string): Promise<string> =>
    tenantClient
      .get<{ success: boolean; photoUrl: string }>(`${BASE}/${uuid}/photo`)
      .then((r) => r.data.photoUrl ?? ''),

  uploadPhoto: (uuid: string, file: File): Promise<string> =>
    tenantClient
      .put<{ success: boolean; photoUrl: string }>(`${BASE}/${uuid}/photo`, file, {
        headers: { 'Content-Type': file.type },
      })
      .then((r) => r.data.photoUrl ?? ''),

  deletePhoto: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}/photo`).then(() => undefined),

  getHistory: (uuid: string): Promise<UnitHistoryEntry[]> =>
    tenantClient
      .get<{ success: boolean; records: UnitHistoryEntry[] }>(`${BASE}/${uuid}/history`)
      .then((r) => r.data.records ?? []),
};
