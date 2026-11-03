import type {
  CustomerTransactionCount,
  CustomerTransactionFilters,
  CustomerTransactionRow,
  CustomerTransactionStatusCount,
} from '@/types/customerTransactions';
import { formatDisplayDate } from '@/lib/dateUtils';
import { formatMoney } from '@/lib/formatMoney';

// Pure helpers for the customer Transactions tab (CustomerTransactionsTab).

/** URL param names; `tab` is owned by the page and must survive filter writes. */
const PARAM = { type: 'type', status: 'status', from: 'from', to: 'to', q: 'q', open: 'open', page: 'page' } as const;
const OPEN_ON = '1';

/** Filter state with nothing applied. */
export const EMPTY_FILTERS: CustomerTransactionFilters = {
  type: '', status: '', from: '', to: '', q: '', open: false, page: 1,
};

/** The filter state encoded in the URL; an invalid page falls back to 1. */
export function parseFilters(sp: URLSearchParams): CustomerTransactionFilters {
  const page = Number(sp.get(PARAM.page));
  return {
    type: sp.get(PARAM.type) ?? '',
    status: sp.get(PARAM.status) ?? '',
    from: sp.get(PARAM.from) ?? '',
    to: sp.get(PARAM.to) ?? '',
    q: sp.get(PARAM.q) ?? '',
    open: sp.get(PARAM.open) === OPEN_ON,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/**
 * A copy of `sp` with `patch` applied on top of its current filters. Defaults
 * are deleted (a clean URL) and unrelated params such as `tab` are preserved.
 * Changing any filter starts again from page 1 unless the patch sets `page`;
 * changing the type also drops a status that belongs to the old type.
 */
export function writeFilters(sp: URLSearchParams, patch: Partial<CustomerTransactionFilters>): URLSearchParams {
  const current = parseFilters(sp);
  const changesFilter = Object.keys(patch).some((k) => k !== 'page');
  const next: CustomerTransactionFilters = { ...current, ...patch };
  if (patch.type !== undefined && patch.type !== current.type && patch.status === undefined) next.status = '';
  if (changesFilter && patch.page === undefined) next.page = 1;

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
  set(PARAM.page, String(next.page), next.page > 1);
  return out;
}

/** Whether any filter (page excluded) is applied. */
export function isFiltered(f: CustomerTransactionFilters): boolean {
  return f.type !== '' || f.status !== '' || f.from !== '' || f.to !== '' || f.q.trim() !== '' || f.open;
}

/** The status filter's options for `type`; empty when no type is chosen. */
export function statusOptions(
  counts: CustomerTransactionCount[],
  type: string,
): CustomerTransactionStatusCount[] {
  if (!type) return [];
  return counts.find((c) => c.type === type)?.statuses ?? [];
}

/** What a row's balance means; empty when the type has no balance. */
export function balanceLabel(row: Pick<CustomerTransactionRow, 'type'>): string {
  if (row.type === 'invoice') return 'Balance due';
  if (row.type === 'payment' || row.type === 'credit_memo') return 'Unapplied';
  return '';
}

/** A monetary figure, or an em dash when absent. */
export function moneyOrDash(n: number | null): string {
  return n === null ? '—' : formatMoney(n);
}

/** An ISO yyyy-mm-dd date for display, or an em dash when absent. */
export function dateOrDash(iso: string | null): string {
  return (iso && formatDisplayDate(iso)) || '—';
}
