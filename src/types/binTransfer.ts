import type { ApprovalOverlay, FilterClause, SortKey } from '@/types/tenant';

// Bin Transfer (BTRF) — a document that moves slabs between bins inside one
// location. Mirrors the backend's bintransfer package; the approval fields come
// from the same overlay every Sales/Purchases record carries.

/** One slab moving to one destination bin. */
export interface BinTransferLine {
  id: string;
  lineNumber: number;

  unitId: string;
  unitSerial: string;
  /** The slab's live status (available, reserved, in_transit, …). */
  unitStatus: string;

  inventoryItemName?: string;
  area: number;
  areaUnitCode?: string;

  /** The bin the slab was in when the line was written. */
  fromBinId?: string | null;
  fromBinPath?: string;
  fromBinName?: string;
  /** Where the slab is right now — differs when it was moved some other way
   *  while the transfer waited. */
  currentBinPath?: string;

  toBinId: string;
  toBinPath: string;
  toBinName?: string;

  notes?: string;
  /** Set when completing the transfer applied this line. */
  movedAt?: string | null;
}

/** A transfer as the list and the detail both carry it (no approval overlay). */
export interface BinTransferRecord {
  id: string;
  number: string;
  statusCode: string;
  statusName: string;
  /** none | pending | approved | rejected. */
  approvalStatus: string;
  /** Legal next moves right now, an unconfigured approval checkpoint collapsed out. */
  nextStatusCodes: string[];

  warehouseId: number;
  warehouseName?: string;

  date: string;
  notes?: string;

  ownerUserId?: string;
  ownerEmployeeId?: number | null;
  ownerName?: string;

  completedAt?: string | null;
  completedByName?: string;
  cancelledAt?: string | null;
  cancelReason?: string;

  slabCount: number;
  totalArea: number;
  /** The destination bin path when every line goes to one bin, else "N bins". */
  toBinSummary?: string;

  customFields: Record<string, unknown>;
  /** Empty on a list row — a single read carries the lines. */
  lines: BinTransferLine[];

  createdAt: string;
  updatedAt: string;
  recordVersion: number;
}

/** A single transfer as the detail page uses it, with the approval overlay. */
export type BinTransfer = BinTransferRecord & ApprovalOverlay;

export interface BinTransferLineInput {
  unitId: string;
  toBinId: string;
  notes?: string;
}

export interface BinTransferInput {
  warehouseId: number;
  date?: string;
  notes?: string;
  ownerEmployeeId?: number;
  customFields?: Record<string, unknown>;
  lines: BinTransferLineInput[];
}

export interface BinTransferSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface BinTransferPage {
  records: BinTransferRecord[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
