import { formatStockQty } from '@/lib/stockShortage';
import type { FabricationMaterial } from '@/types/fabrication';
import type { StockShortage } from '@/types/salesOrder';

// How a job's material stands, for the Materials tab.

const PERCENT = 100;

/** covered: nothing more to allocate. short: more is needed and the shelf has it.
 *  unstocked: more is needed than the shelf holds — the job cannot be covered
 *  until stock arrives. */
export type MaterialState = 'covered' | 'short' | 'unstocked';

export function materialState(m: FabricationMaterial): MaterialState {
  if (m.shortfall <= 0) return 'covered';
  return m.shortfall > m.inStock ? 'unstocked' : 'short';
}

/** How much of the need is allocated, 0–100 (a job with no need is complete). */
export function coveragePercent(m: FabricationMaterial): number {
  if (m.needed <= 0) return PERCENT;
  return Math.min(PERCENT, (m.allocated / m.needed) * PERCENT);
}

/** Where the "needed" figure comes from, in words. */
export function basisLabel(m: FabricationMaterial): string {
  if (m.basis === 'order') return 'Ordered quantity — no pieces drawn yet';
  return `Blueprint · ${m.pieceCount} ${m.pieceCount === 1 ? 'piece' : 'pieces'}`;
}

/** What the shelf lacks to cover the job: the shortfall beyond what is in stock. */
export function missingFromStock(m: FabricationMaterial): number {
  return Math.max(0, m.shortfall - m.inStock);
}

/** The material as a stock shortage — what would have to be bought — for the
 *  "create requisition" hand-off. Null when the shelf already covers it. */
export function asShortage(m: FabricationMaterial): StockShortage | null {
  const missing = missingFromStock(m);
  if (missing <= 0) return null;
  return {
    itemId: m.itemId, sku: m.sku, name: m.name, unitCode: m.unitCode,
    requested: m.shortfall, available: m.inStock, short: missing,
  };
}

export function describeShortfall(m: FabricationMaterial): string {
  return `${formatStockQty(m.shortfall, m.unitCode)} more to allocate`;
}
