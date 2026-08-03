import type { InventoryItem, InventoryUnit } from '@/types/inventory';

// Draft-line model + helpers for the adjustment line editor, kept out of the
// component file (eslint-plugin-react-refresh's `vite` preset errors on a
// component file exporting non-component bindings).

let seq = 0;
export function nextLineKey() { seq += 1; return `adj-line-${seq}`; }

export interface AdjustmentDraftLine {
  key: string;
  item: InventoryItem | null;
  unit: InventoryUnit | null;
  sign: 1 | -1;
  qtyDelta: string;
  reasonId: string;
  notes: string;
}

export function emptyAdjustmentLine(): AdjustmentDraftLine {
  return { key: nextLineKey(), item: null, unit: null, sign: -1, qtyDelta: '', reasonId: '', notes: '' };
}
