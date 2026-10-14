import type { BinTransfer, BinTransferLine } from '@/types/binTransfer';

// A line moving one slab from YARD/A1 to RACK/B2. Tests override what they care about.
export function makeLine(overrides: Partial<BinTransferLine> = {}): BinTransferLine {
  return {
    id: '1',
    lineNumber: 1,
    unitId: 'u-1',
    unitSerial: 'SLB-000231',
    unitStatus: 'available',
    inventoryItemName: 'Absolute Black 3cm',
    area: 54.2,
    areaUnitCode: 'SQFT',
    fromBinId: 'bin-a1',
    fromBinPath: 'YARD/A1',
    currentBinPath: 'YARD/A1',
    toBinId: 'bin-b2',
    toBinPath: 'RACK/B2',
    toBinName: 'Rack B2',
    ...overrides,
  };
}

// An ungated draft BTRF-000012 of one slab, owned by Maria. The approval overlay
// is at its "nothing configured" defaults.
export function makeTransfer(overrides: Partial<BinTransfer> = {}): BinTransfer {
  return {
    id: 'bt-12',
    number: 'BTRF-000012',
    statusCode: 'DRFT',
    statusName: 'Draft',
    approvalStatus: 'none',
    nextStatusCodes: ['CANC', 'COMP'],
    warehouseId: 1,
    warehouseName: 'Main Yard',
    date: '2026-10-14',
    notes: '',
    ownerName: 'Maria Lopez',
    slabCount: 1,
    totalArea: 54.2,
    toBinSummary: 'RACK/B2',
    customFields: {},
    lines: [makeLine()],
    createdAt: '2026-10-14T08:00:00',
    updatedAt: '2026-10-14T08:00:00',
    recordVersion: 1,
    gated: false,
    approvers: [],
    requiredApprovals: 0,
    approvedCount: 0,
    canApprove: false,
    isOverride: false,
    callerAlreadyApproved: false,
    canReject: false,
    ...overrides,
  };
}
