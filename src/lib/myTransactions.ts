import type {
  TransactionRole,
  TransactionRoleFilter,
  TransactionRow,
  TransactionType,
} from '@/types/myTransactions';
import { recordRoute } from '@/lib/recentRecordRoute';

// Pure helpers for the My Transactions page (TransactionsPage).

/** Tone of a status badge. */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

// lkp_record_status codes (and the slab enum's lowercase values) grouped by
// what they mean to the reader. Codes outside every group render neutral, so a
// status added to the backend degrades gracefully instead of breaking the page.
const TONE_BY_CODE: Record<string, StatusTone> = {
  APPV: 'success', PAID: 'success', FILL: 'success', RCVD: 'success', APPL: 'success',
  DEPO: 'success', CONV: 'success', ACT_: 'success', available: 'success',
  PAPV: 'warning', PEND: 'warning', PART: 'warning', OPEN: 'warning',
  ODUE: 'danger', RJCT: 'danger', EXPR: 'danger',
  SENT: 'info', reserved: 'info',
  DRFT: 'muted', CANC: 'muted', INA_: 'muted', VOID: 'muted', CLSD: 'muted',
  consumed: 'muted', scrapped: 'muted',
};

/** The badge tone for a status code; neutral for an unknown or empty code. */
export function statusTone(code: string): StatusTone {
  return TONE_BY_CODE[code] ?? 'muted';
}

export const STATUS_TONE_CLASSES: Record<StatusTone, { dot: string; badge: string }> = {
  success: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  warning: { dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  danger: { dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200' },
  info: { dot: 'bg-sky-400', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
  muted: { dot: 'bg-stone-400', badge: 'bg-stone-100 text-stone-600 border-stone-200' },
};

/** Route-domain groups, in the order the type filter lists them. */
export const DOMAIN_LABELS: Record<string, string> = {
  crm: 'CRM',
  sales: 'Sales',
  purchases: 'Purchases',
  inventory: 'Inventory',
  finance: 'Finance',
};

const DOMAIN_ORDER = Object.keys(DOMAIN_LABELS);

/** Type-badge classes per domain (one colour per domain keeps 26 types scannable). */
export const DOMAIN_BADGE: Record<string, string> = {
  crm: 'bg-violet-50 text-violet-700',
  sales: 'bg-sky-50 text-sky-700',
  purchases: 'bg-amber-50 text-amber-700',
  inventory: 'bg-emerald-50 text-emerald-700',
  finance: 'bg-indigo-50 text-indigo-700',
};
export const FALLBACK_DOMAIN_BADGE = 'bg-stone-100 text-stone-700';

export interface TypeGroup {
  domain: string;
  label: string;
  types: TransactionType[];
}

/**
 * Groups the readable types by domain for the type filter, domains in a fixed
 * order and types alphabetical within a group. An unrecognised domain is kept
 * (after the known ones) rather than dropped.
 */
export function groupTypesByDomain(types: TransactionType[]): TypeGroup[] {
  const byDomain = new Map<string, TransactionType[]>();
  for (const t of types) {
    byDomain.set(t.domain, [...(byDomain.get(t.domain) ?? []), t]);
  }
  const domains = [...byDomain.keys()].sort((a, b) => {
    const ra = DOMAIN_ORDER.indexOf(a);
    const rb = DOMAIN_ORDER.indexOf(b);
    return (ra === -1 ? DOMAIN_ORDER.length : ra) - (rb === -1 ? DOMAIN_ORDER.length : rb);
  });
  return domains.map((domain) => ({
    domain,
    label: DOMAIN_LABELS[domain] ?? domain,
    types: [...(byDomain.get(domain) ?? [])].sort((a, b) => a.label.localeCompare(b.label)),
  }));
}

export const ROLE_FILTER_OPTIONS: { value: TransactionRoleFilter; label: string }[] = [
  { value: 'all', label: 'All activity' },
  { value: 'created', label: 'Created by me' },
  { value: 'updated', label: 'Updated by me' },
];

export const ROLE_LABELS: Record<TransactionRole, string> = {
  created: 'Created',
  updated: 'Updated',
};

// ── Paging ───────────────────────────────────────────────────────────────────

/** Page sizes the "rows per page" picker offers (the backend caps at 100). */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

/** How many pages `total` rows make at `pageSize` per page; never below 1. */
export function pageCount(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) return 1;
  return Math.ceil(total / pageSize);
}

/** The 1-based, inclusive row range a page shows; both 0 when there are no rows. */
export function pageRange(page: number, pageSize: number, total: number): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  const from = (page - 1) * pageSize + 1;
  return { from, to: Math.min(page * pageSize, total) };
}

/** One slot in the page-number strip: a page, or a gap standing in for several. */
export type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

// The strip is capped at this many slots so it never outgrows a phone screen
// and never changes width as the user pages.
const MAX_STRIP_SLOTS = 7;
const EDGE_RUN = 5; // pages shown next to the first/last when the current page is near it

/**
 * The page-number strip: every page when they fit, otherwise the first and last
 * page, the current page with a neighbour either side, and gaps between —
 * always MAX_STRIP_SLOTS slots, so the controls do not jump around.
 */
export function buildPageItems(current: number, count: number): PageItem[] {
  if (count <= MAX_STRIP_SLOTS) return Array.from({ length: count }, (_, i) => i + 1);
  const nearStart = current <= EDGE_RUN - 1;
  const nearEnd = current >= count - (EDGE_RUN - 2);
  if (nearStart) {
    return [...Array.from({ length: EDGE_RUN }, (_, i) => i + 1), 'ellipsis-end', count];
  }
  if (nearEnd) {
    return [1, 'ellipsis-start', ...Array.from({ length: EDGE_RUN }, (_, i) => count - EDGE_RUN + 1 + i)];
  }
  return [1, 'ellipsis-start', current - 1, current, current + 1, 'ellipsis-end', count];
}

/** Formats a monetary total; an em dash when the record type has none. */
export function formatAmount(amount: number | null): string {
  if (amount === null) return '—';
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

/** The detail-page link for a row. */
export function rowHref(row: Pick<TransactionRow, 'domain' | 'module' | 'id'>): string {
  return recordRoute(row.domain, row.module, row.id);
}

/** What to show as a row's headline: its reference, else its title, else a dash. */
export function rowHeadline(row: Pick<TransactionRow, 'number' | 'name'>): string {
  return row.number || row.name || '—';
}

/** The row's secondary line: its title, unless that is already the headline. */
export function rowSubline(row: Pick<TransactionRow, 'number' | 'name'>): string {
  return row.number && row.name ? row.name : '';
}
