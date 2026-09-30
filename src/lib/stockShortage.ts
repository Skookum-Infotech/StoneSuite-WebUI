import { isAxiosError } from 'axios';
import { unitLabel } from '@/lib/unitLabels';
import type { StockShortage } from '@/types/salesOrder';

// A Sales Order save that asks for more stock than is free is refused with a
// structured 409 (backend controllers/stock_shortage_response.go) rather than a
// bare message, so the screen can list every short item and offer to restock.

/** The `code` the server puts on that 409. */
export const INSUFFICIENT_STOCK_CODE = 'insufficient_stock';

const HTTP_CONFLICT = 409;
const MAX_QTY_DECIMALS = 3;

/** The short items when `error` is the server's "not enough stock" refusal, else
 *  null — so any other failure still shows as an ordinary error. */
export function stockShortagesFrom(error: unknown): StockShortage[] | null {
  if (!isAxiosError(error) || error.response?.status !== HTTP_CONFLICT) return null;
  const body = error.response.data as { code?: unknown; shortages?: unknown } | undefined;
  if (body?.code !== INSUFFICIENT_STOCK_CODE || !Array.isArray(body.shortages) || body.shortages.length === 0) {
    return null;
  }
  return body.shortages as StockShortage[];
}

/** "45.208 sq ft", "12 each" — a quantity with what it is measured in, trimmed
 *  of trailing zeros (a count is not shown as 12.000). */
export function formatStockQty(value: number, unitCode?: string): string {
  const number = value.toLocaleString('en-US', { maximumFractionDigits: MAX_QTY_DECIMALS });
  const unit = unitLabel(unitCode).toLowerCase();
  return unit ? `${number} ${unit}` : number;
}
