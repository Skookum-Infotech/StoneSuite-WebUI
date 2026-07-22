// Fabrication & Installation module — frontend contract types.
//
// Mirrors the dedicated relational backend module described in
// `StoneSuite-Backend/docs/superpowers/specs/2026-07-22-fabrication-installation-module-design.md`.
// A fabrication job is a production record spawned from a Sales Order,
// tracking a stone order through 16 shop-floor statuses with serialized slab
// allocation and a 16-step checklist. Served from
// `/api/tenant/fabrication-jobs*` and `/api/tenant/inventory/slabs*` — a
// relational sibling of Sales Order, not the generic JSONB CRM router.
import type { FilterClause, SortKey } from '@/types/tenant';

export interface FabricationCustomerRef {
  id: string;
  name: string;
}

export interface FabricationSiteAddress {
  customerName?: string;
  addrLine1?: string;
  addrLine2?: string;
  city?: string;
  stateId?: number | null;
  zip?: string;
  phone?: string;
}

export interface FabricationJobPiece {
  id: string;
  pieceNumber: number;
  pieceName: string;
  pieceType: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  sinkCutoutCount: number;
  cooktopCutoutCount: number;
  seamCount: number;
  status: string;
}

/** One row of the 16-step checklist. Piece-grain steps (templating, cutting,
 *  edging, etc.) are seeded once per piece — the backend returns one row per
 *  (step code, piece) with no piece id on the row, so several rows can share
 *  a code. `PATCH .../steps/{stepCode}` updates every row sharing that code
 *  in one call; there is no way to target a single piece's row yet. */
export interface FabricationJobStep {
  code: string;
  sequence: number;
  status: 'pending' | 'in_progress' | 'blocked' | 'skipped' | 'completed';
  notes?: string;
  payload?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
}

export interface FabricationJobPieceInput {
  pieceNumber: number;
  pieceName: string;
  pieceType: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  sinkCutoutCount: number;
  cooktopCutoutCount: number;
  seamCount: number;
  /** Links this piece to a sales order line — must belong to the job's
   *  originating sales order. */
  salesOrderItemUuid?: string;
}

/** Header fields shared by create and update. Pieces are create-only — the
 *  backend has no endpoint to add/edit pieces after a job exists (Update is
 *  header-only), so pieces render read-only everywhere except the Add page. */
export interface FabricationJobFields {
  siteCustomerName?: string;
  siteAddrLine1?: string;
  siteAddrLine2?: string;
  siteCity?: string;
  siteStateId?: number | null;
  siteZip?: string;
  sitePhone?: string;
  templateDate?: string;
  fabricationStart?: string;
  promisedInstallDate?: string;
  ownerEmployeeId?: number | null;
  templaterEmployeeId?: number | null;
  fabricatorEmployeeId?: number | null;
  installCrewEmployeeId?: number | null;
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface FabricationJobCreatePayload extends FabricationJobFields {
  salesOrderUuid: string;
  pieces?: FabricationJobPieceInput[];
}

export type FabricationJobUpdatePayload = FabricationJobFields;

export interface FabricationJob {
  id: string;
  jobNumber: string;
  status: string;
  statusCode: string;
  approvalStatus: 'none' | 'pending' | 'approved';
  salesOrderId: string;
  customer: FabricationCustomerRef;
  heldFromStatusCode?: string;
  cancelRequested: boolean;
  site: FabricationSiteAddress;
  templateDate?: string;
  fabricationStart?: string;
  promisedInstallDate?: string;
  actualInstallDate?: string;
  ownerEmployeeId: number | null;
  templaterEmployeeId: number | null;
  fabricatorEmployeeId: number | null;
  installCrewEmployeeId: number | null;
  notes?: string;
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  pieces?: FabricationJobPiece[];
  steps?: FabricationJobStep[];
}

/** Search request = the shared `query.Request` plus the resolver's global
 *  search term (job number, site customer name, notes, customer name).
 *  Sortable fields: `created_at`, `updated_at`, `record_number` (base) plus
 *  `promised_install_date` (fabrication-specific) — status is deliberately
 *  not sortable server-side. */
export interface FabricationJobSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface FabricationJobPage {
  records: FabricationJob[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}

/** A serialized physical slab (inventory_slab). */
export interface FabricationSlab {
  id: string;
  serial: string;
  vendorId: number | null;
  supplierCode?: string;
  inventoryItemId: string;
  warehouseId: number;
  bundleId?: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  area: number;
  form: 'full' | 'cut';
  /** On the standalone slab catalog this is the physical slab status
   *  (available|reserved|consumed|scrapped). On a job's Slabs tab
   *  (`InventoryForJob`) the backend substitutes this same field with the
   *  job-allocation status instead (reserved|consumed|released) — the field
   *  name is shared but its meaning depends on which endpoint returned it. */
  status: string;
  parentSlabId?: string;
  grade?: string;
  finish?: string;
}

export interface CreateSlabInput {
  serial: string;
  vendorId?: number | null;
  supplierCode?: string;
  inventoryItemUuid: string;
  warehouseId: number;
  bundleId?: string;
  blockId?: string;
  lot?: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  area: number;
  grade?: string;
  finish?: string;
}

export type SlabDisposition = 'recovered' | 'scrapped' | 'delivered';

/** Declares the fate of one consumed slab while a job is cancel-requested
 *  (§4.4.1). Write-once per slab; `recovered` mints a child offcut capped at
 *  the parent's remaining area, so `recoveredArea` is required for it. */
export interface SlabDispositionInput {
  disposition: SlabDisposition;
  recoveredArea?: number;
  lengthMm?: number;
  widthMm?: number;
  thicknessMm?: number;
}
