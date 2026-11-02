import type { ReorderItem, VendorQty } from '@/types/replenishment';

/** Mirrors the backend's cap on vendors per item (replenishment.MaxDraftVendors). */
export const MAX_DRAFT_VENDORS = 10;

/** Mirrors the backend's cap on one vendor's quantity. */
export const MAX_DRAFT_QUANTITY = 100000;

/** A slab-tracked item is ordered by the whole slab. */
export const SLAB_UNIT = 'slabs';

const QTY_DECIMALS = 100;
const PLAN_DECIMALS = 1000;

/** React Query key for the Reorder list. */
export const REORDER_QUERY_KEY = 'replenishment';

/** Draft purchase orders just created for one item, kept on the page so the
 *  buyer can open them after the item has dropped off the list. */
export interface CreatedBatch {
  key: string;
  itemName: string;
  orders: ReadonlyArray<{ id: string; vendorName: string }>;
}

/** One vendor line of an item's split, as the card holds it while typing. */
export interface VendorSplitRow {
  key: string;
  vendor: { id: string; name: string } | null;
  qty: string;
}

let splitRowCount = 0;

/** A blank vendor line with a key that stays stable while rows are added and removed. */
export function newSplitRow(qty: string): VendorSplitRow {
  splitRowCount += 1;
  return { key: `split-row-${splitRowCount}`, vendor: null, qty };
}

export function isSlabItem(item: Pick<ReorderItem, 'unit'>): boolean {
  return item.unit === SLAB_UNIT;
}

/** The `step` a quantity input needs: whole slabs, but any fraction of a
 *  bulk unit. Without a step the browser only accepts whole numbers. */
export function qtyStep(item: Pick<ReorderItem, 'unit'>): string {
  return isSlabItem(item) ? '1' : '0.01';
}

/** 'Aug' for '2026-08'. Falls back to the raw label for anything unparseable. */
export function monthName(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  if (!year || !mon) return month;
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
}

/** "a, b, and c" — the serial comma, and one or two items without it. */
function joinList(parts: ReadonlyArray<string>): string {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/** "Aug, Sep, and Oct" */
export function monthsPhrase(months: ReadonlyArray<string>): string {
  return joinList(months.map(monthName));
}

/** "50, 48, and 50" — what was used in each month. */
export function usagePhrase(item: Pick<ReorderItem, 'usage'>): string {
  return joinList(item.usage.map((u) => fmtQty(u.used)));
}

export function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * QTY_DECIMALS) / QTY_DECIMALS);
}

function parseQty(raw: string): number {
  const n = Number(raw.trim());
  return raw.trim() !== '' && Number.isFinite(n) ? n : 0;
}

/** The sum of the quantities typed so far, ignoring blank or invalid rows. */
export function plannedTotal(rows: ReadonlyArray<Pick<VendorSplitRow, 'qty'>>): number {
  return Math.round(rows.reduce((sum, r) => sum + Math.max(parseQty(r.qty), 0), 0) * PLAN_DECIMALS) / PLAN_DECIMALS;
}

/** How the planned total compares with what is needed: "40 of 40 planned",
 *  "25 of 40 planned · 15 still short", "50 of 40 planned · 10 extra". */
export function planSummary(needed: number, planned: number): string {
  const base = `${fmtQty(planned)} of ${fmtQty(needed)} planned`;
  const diff = Math.round((needed - planned) * PLAN_DECIMALS) / PLAN_DECIMALS;
  if (diff > 0) return `${base} · ${fmtQty(diff)} still short`;
  if (diff < 0) return `${base} · ${fmtQty(-diff)} extra`;
  return base;
}

/** The first thing wrong with the split, or null when it can be created. */
export function splitError(item: Pick<ReorderItem, 'unit'>, rows: ReadonlyArray<VendorSplitRow>): string | null {
  if (rows.length === 0) return 'Add a vendor.';
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.vendor) return 'Choose a vendor for every line.';
    if (seen.has(row.vendor.id)) return 'Each vendor can only appear once.';
    seen.add(row.vendor.id);
    const qty = parseQty(row.qty);
    if (!(qty > 0) || qty > MAX_DRAFT_QUANTITY) {
      return `Enter a quantity between 1 and ${MAX_DRAFT_QUANTITY} for every vendor.`;
    }
    if (isSlabItem(item) && !Number.isInteger(qty)) return 'Enter a whole number of slabs.';
  }
  return null;
}

/** The request body for a split that passed splitError. */
export function vendorQuantities(rows: ReadonlyArray<VendorSplitRow>): VendorQty[] {
  return rows.flatMap((r) => (r.vendor ? [{ vendorId: r.vendor.id, qty: parseQty(r.qty) }] : []));
}

/** The button label: one PO, or one per vendor. */
export function createLabel(vendorCount: number): string {
  return vendorCount > 1 ? `Create ${vendorCount} draft POs` : 'Create PO';
}
