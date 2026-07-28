import { tenantClient } from '@/api/tenantClient';
import type {
  InventoryUnit, CreateUnitInput, UnitPage, UnitSearchRequest,
  MoveUnitInput, ScrapUnitInput, CutUnitInput, CutResult,
} from '@/types/inventory';

// Physical units — slabs and remnants — `inventory_unit` RBAC resource.
// Legacy `/inventory/slabs/*` paths are served by the same backend handlers;
// this service only uses the current `/inventory/units/*` paths.
const BASE = '/tenant/inventory/units';

export const inventoryUnitService = {
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

  createUnit: (payload: CreateUnitInput): Promise<InventoryUnit> =>
    tenantClient
      .post<{ success: boolean; unit: InventoryUnit }>(BASE, payload)
      .then((r) => r.data.unit),

  // Stock-neutral — moves bin only, never fires a ledger entry. Refused for
  // in_transit, consumed or scrapped units (server message explains why).
  moveBin: (uuid: string, payload: MoveUnitInput): Promise<InventoryUnit> =>
    tenantClient
      .patch<{ success: boolean; unit: InventoryUnit }>(`${BASE}/${uuid}/bin`, payload)
      .then((r) => r.data.unit),

  scrap: (uuid: string, payload: ScrapUnitInput): Promise<InventoryUnit> =>
    tenantClient
      .post<{ success: boolean; unit: InventoryUnit }>(`${BASE}/${uuid}/scrap`, payload)
      .then((r) => r.data.unit),

  cut: (uuid: string, payload: CutUnitInput): Promise<CutResult> =>
    tenantClient
      .post<{ success: boolean } & CutResult>(`${BASE}/${uuid}/cut`, payload)
      .then((r) => r.data),

  getHistory: (uuid: string): Promise<{ action: string; at: string; byName: string }[]> =>
    tenantClient
      .get<{ success: boolean; history: { action: string; at: string; byName: string }[] }>(`${BASE}/${uuid}/history`)
      .then((r) => r.data.history ?? []),
};
