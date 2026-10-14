import type { InventoryUnit } from '@/types/inventory';
import type { BinTransferLine, BinTransferLineInput } from '@/types/binTransfer';

// The draft model behind the Bin Transfer editor. A line is a slab plus the bin
// it is going to; everything else is display. Kept free of React so the rules
// (no duplicate slab, no move to where the slab already is, what is sent) are
// testable on their own and match what the server enforces.

export interface BinTransferDraftLine {
  /** Client-only key, so a row keeps its identity while the list changes. */
  key: string;
  unitId: string;
  serial: string;
  itemName: string;
  area: number;
  areaUnitCode: string;
  /** Where the slab is now, when known — a saved line only knows the path. */
  currentBinId: string | null;
  currentBinPath: string;
  toBinId: string;
  notes: string;
}

let nextKey = 0;
function newKey(): string {
  nextKey += 1;
  return `bt-line-${nextKey}`;
}

export function draftLineFromUnit(unit: InventoryUnit, toBinId = ''): BinTransferDraftLine {
  return {
    key: newKey(),
    unitId: unit.id,
    serial: unit.serial,
    itemName: unit.inventoryItemName ?? '',
    area: unit.area,
    areaUnitCode: unit.areaUnitCode ?? '',
    currentBinId: unit.binId ?? null,
    currentBinPath: unit.binPath ?? '',
    toBinId,
    notes: '',
  };
}

/** Rebuilds a saved line for the edit page. The slab's current bin id is not on
 *  a saved line, so "already in that bin" is left to the server there. */
export function draftLineFromRecord(line: BinTransferLine): BinTransferDraftLine {
  return {
    key: newKey(),
    unitId: line.unitId,
    serial: line.unitSerial,
    itemName: line.inventoryItemName ?? '',
    area: line.area,
    areaUnitCode: line.areaUnitCode ?? '',
    currentBinId: null,
    currentBinPath: line.currentBinPath ?? line.fromBinPath ?? '',
    toBinId: line.toBinId,
    notes: line.notes ?? '',
  };
}

/** Appends slabs not already on the transfer, pre-filling the destination unless
 *  the slab is already sitting there. */
export function addUnits(
  lines: BinTransferDraftLine[], units: InventoryUnit[], defaultToBinId: string,
): BinTransferDraftLine[] {
  const have = new Set(lines.map((l) => l.unitId));
  const added: BinTransferDraftLine[] = [];
  for (const unit of units) {
    if (have.has(unit.id)) continue;
    have.add(unit.id);
    const same = defaultToBinId !== '' && unit.binId === defaultToBinId;
    added.push(draftLineFromUnit(unit, same ? '' : defaultToBinId));
  }
  return [...lines, ...added];
}

/** Sets one destination on every line — except a slab already in it, which is
 *  left blank so it surfaces as the thing to fix rather than a no-op move. */
export function applyDestinationToAll(lines: BinTransferDraftLine[], toBinId: string): BinTransferDraftLine[] {
  return lines.map((l) => ({ ...l, toBinId: l.currentBinId !== null && l.currentBinId === toBinId ? '' : toBinId }));
}

/** The API shape: ids and notes only. The from-bin is read off the slab by the
 *  server, never accepted from the client. */
export function toLineInputs(lines: BinTransferDraftLine[]): BinTransferLineInput[] {
  return lines.map((l) => {
    const notes = l.notes.trim();
    return { unitId: l.unitId, toBinId: l.toBinId, ...(notes ? { notes } : {}) };
  });
}

/** The first thing wrong with a draft, in the server's own words, or null. */
export function validateDraft(lines: BinTransferDraftLine[], locationId: string): string | null {
  if (!locationId) return 'Choose a location.';
  if (lines.length === 0) return 'Add at least one slab.';
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (!l.toBinId) return `Line ${i + 1} (${l.serial}) needs a destination bin.`;
    if (l.currentBinId !== null && l.currentBinId === l.toBinId) {
      return `Line ${i + 1} (${l.serial}) is already in that bin.`;
    }
  }
  return null;
}

export interface DraftSummary {
  count: number;
  totalArea: number;
  /** Distinct destination bins chosen so far. */
  destinations: number;
  areaUnitCode: string;
}

export function summarizeDraft(lines: BinTransferDraftLine[]): DraftSummary {
  const dest = new Set(lines.map((l) => l.toBinId).filter(Boolean));
  const totalArea = lines.reduce((sum, l) => sum + l.area, 0);
  return {
    count: lines.length,
    totalArea: Math.round(totalArea * 100) / 100,
    destinations: dest.size,
    areaUnitCode: lines[0]?.areaUnitCode ?? '',
  };
}
