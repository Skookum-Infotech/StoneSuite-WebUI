import type { RequisitionLineItem } from '@/lib/requisitionForm';
import type { StockShortage } from '@/types/salesOrder';

// Hands a stock shortfall from a Sales Order to a new Requisition. The requisition
// opens in a NEW tab so the order being edited is not lost, and a new tab shares
// no router state — so the lines travel through localStorage, which both tabs see.

export const REQUISITION_PREFILL_KEY = 'stonesuite.requisitionPrefill';

const NEW_REQUISITION_PATH = '/purchases/requisition/new';
const MAX_QTY_DECIMALS = 3;

/** One requisition line to start with. Strings, as the form holds them. */
export interface PrefillLine {
  inventoryItemUuid: string;
  itemName: string;
  itemSku: string;
  units: string;
  quantity: string;
}

/** The lines that would cover what each short item is missing. */
export function prefillLinesFrom(shortages: StockShortage[]): PrefillLine[] {
  return shortages.map((s) => ({
    inventoryItemUuid: s.itemId,
    itemName: s.name,
    itemSku: s.sku,
    units: s.unitCode,
    quantity: String(Number(s.short.toFixed(MAX_QTY_DECIMALS))),
  }));
}

/** Stores the lines for the requisition page to pick up. False if storage is
 *  unavailable (private window, blocked site data) — the caller opens a blank
 *  requisition rather than failing. */
export function stashRequisitionPrefill(shortages: StockShortage[]): boolean {
  try {
    window.localStorage.setItem(REQUISITION_PREFILL_KEY, JSON.stringify(prefillLinesFrom(shortages)));
    return true;
  } catch {
    return false;
  }
}

function isPrefillLine(v: unknown): v is PrefillLine {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return ['inventoryItemUuid', 'itemName', 'itemSku', 'units', 'quantity'].every((k) => typeof o[k] === 'string');
}

/** The stashed lines as requisition line items, or null if there are none. Reads
 *  without removing, so a re-render or a StrictMode double-run cannot lose them;
 *  the page calls clearRequisitionPrefill when it goes away. */
export function peekRequisitionPrefill(): RequisitionLineItem[] | null {
  try {
    const raw = window.localStorage.getItem(REQUISITION_PREFILL_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isPrefillLine)) return null;
    return parsed.map((l, i) => ({
      id: `reqn-prefill-${i + 1}`,
      lineNo: i + 1,
      itemName: l.itemName,
      itemDescription: '',
      quantity: l.quantity,
      estimatedUnitPrice: '',
      amount: '',
      inventoryItemUuid: l.inventoryItemUuid,
      itemSku: l.itemSku,
      units: l.units,
    }));
  } catch {
    return null;
  }
}

export function clearRequisitionPrefill(): void {
  try {
    window.localStorage.removeItem(REQUISITION_PREFILL_KEY);
  } catch {
    /* nothing stashed that we could reach — nothing to clear */
  }
}

/** Opens a new requisition, pre-filled with the shortfall, in a new tab. */
export function openRequisitionForShortages(shortages: StockShortage[]): void {
  stashRequisitionPrefill(shortages);
  window.open(NEW_REQUISITION_PATH, '_blank', 'noopener');
}
