import type {
  VendorTransactionCount,
  VendorTransactionFilters,
  VendorTransactionRow,
  VendorTransactionStatusCount,
} from '@/types/vendorTransactions';

// Pure helpers for the vendor Transactions tab (VendorTransactionsTab). Money
// and date formatting is shared with the customer tab (lib/customerTransactions).

/** URL param names; `tab` is owned by the page and must survive filter writes. */
const PARAM = { type: 'type', status: 'status', from: 'from', to: 'to', q: 'q', open: 'open', cursor: 'cursor' } as const;
const OPEN_ON = '1';

/** Filter state with nothing applied. */
export const EMPTY_FILTERS: VendorTransactionFilters = {
  type: '', status: '', from: '', to: '', q: '', open: false, cursor: '',
};

/** The filter state encoded in the URL. */
export function parseFilters(sp: URLSearchParams): VendorTransactionFilters {
  return {
    type: sp.get(PARAM.type) ?? '',
    status: sp.get(PARAM.status) ?? '',
    from: sp.get(PARAM.from) ?? '',
    to: sp.get(PARAM.to) ?? '',
    q: sp.get(PARAM.q) ?? '',
    open: sp.get(PARAM.open) === OPEN_ON,
    cursor: sp.get(PARAM.cursor) ?? '',
  };
}

/**
 * A copy of `sp` with `patch` applied on top of its current filters. Defaults
 * are deleted (a clean URL) and unrelated params such as `tab` are preserved.
 * A cursor belongs to one filter set, so changing any filter returns to the
 * first page unless the patch sets `cursor`; changing the type also drops a
 * status that belongs to the old type.
 */
export function writeFilters(sp: URLSearchParams, patch: Partial<VendorTransactionFilters>): URLSearchParams {
  const current = parseFilters(sp);
  const changesFilter = Object.keys(patch).some((k) => k !== 'cursor');
  const next: VendorTransactionFilters = { ...current, ...patch };
  if (patch.type !== undefined && patch.type !== current.type && patch.status === undefined) next.status = '';
  if (changesFilter && patch.cursor === undefined) next.cursor = '';

  const out = new URLSearchParams(sp);
  const set = (key: string, value: string, keep: boolean) => {
    if (keep) out.set(key, value);
    else out.delete(key);
  };
  set(PARAM.type, next.type, next.type !== '');
  set(PARAM.status, next.status, next.status !== '');
  set(PARAM.from, next.from, next.from !== '');
  set(PARAM.to, next.to, next.to !== '');
  set(PARAM.q, next.q, next.q.trim() !== '');
  set(PARAM.open, OPEN_ON, next.open);
  set(PARAM.cursor, next.cursor, next.cursor !== '');
  return out;
}

/** Whether any filter (cursor excluded) is applied. */
export function isFiltered(f: VendorTransactionFilters): boolean {
  return f.type !== '' || f.status !== '' || f.from !== '' || f.to !== '' || f.q.trim() !== '' || f.open;
}

/** The status filter's options for `type`; empty when no type is chosen. */
export function statusOptions(
  counts: VendorTransactionCount[],
  type: string,
): VendorTransactionStatusCount[] {
  if (!type) return [];
  return counts.find((c) => c.type === type)?.statuses ?? [];
}

/** What a row's balance means; empty when the type has no balance. */
export function balanceLabel(row: Pick<VendorTransactionRow, 'type'>): string {
  if (row.type === 'vendor_bill') return 'Balance due';
  if (row.type === 'vendor_payment' || row.type === 'vendor_credit') return 'Unapplied';
  return '';
}

/** Sum of every type's count — the "All" badge. */
export function totalCount(counts: VendorTransactionCount[]): number {
  return counts.reduce((sum, c) => sum + c.count, 0);
}
