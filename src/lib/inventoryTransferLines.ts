import type { InventoryItem, InventoryUnit } from '@/types/inventory';

// Draft-line model + helpers for the transfer line editor, kept out of the
// component file (eslint-plugin-react-refresh's `vite` preset errors on a
// component file exporting non-component bindings).

let seq = 0;
export function nextLineKey() { seq += 1; return `trf-line-${seq}`; }

export interface TransferDraftLine {
  key: string;
  item: InventoryItem | null;
  unit: InventoryUnit | null;
  qty: string;
  notes: string;
}

export function emptyTransferLine(): TransferDraftLine {
  return { key: nextLineKey(), item: null, unit: null, qty: '', notes: '' };
}
