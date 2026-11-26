// Pure search / filter / sort for the Tenant Usage table. The overview holds
// every tenant (one row each), so this runs over the full list in memory.
import { SEVERITY_RANK } from '@/lib/usageWatchlist';
import type { TenantUsageRow } from '@/types/platformUsage';

export type UsageSortKey = 'name' | 'users' | 'compute' | 'db' | 'r2' | 'ai' | 'errors' | 'alert';
export type SortDir = 'asc' | 'desc';

export const ALL_STATUSES = 'all';

/** Unmeasured values (null) always sort last, whichever way the column is sorted. */
const SORT_VALUE: Record<Exclude<UsageSortKey, 'name'>, (r: TenantUsageRow) => number | null> = {
  users: (r) => (r.totalUsers > 0 ? r.activeUsers / r.totalUsers : null),
  compute: (r) => r.computeHours,
  db: (r) => r.dbBytes,
  r2: (r) => r.r2Bytes,
  ai: (r) => r.aiTokens,
  errors: (r) => r.errorRatePct,
  // Higher = more severe, so "desc" puts critical first.
  alert: (r) => (r.topSeverity ? Object.keys(SEVERITY_RANK).length - SEVERITY_RANK[r.topSeverity] : 0),
};

export function filterUsageRows(rows: readonly TenantUsageRow[], query: string, status: string): TenantUsageRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (status === ALL_STATUSES || r.status === status) &&
      (!q || r.displayName.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q)),
  );
}

export function sortUsageRows(rows: readonly TenantUsageRow[], key: UsageSortKey, dir: SortDir): TenantUsageRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  if (key === 'name') {
    return [...rows].sort((a, b) => a.displayName.localeCompare(b.displayName) * sign);
  }
  const pick = SORT_VALUE[key];
  return [...rows].sort((a, b) => {
    const va = pick(a);
    const vb = pick(b);
    if (va === null && vb === null) return a.displayName.localeCompare(b.displayName);
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * sign || a.displayName.localeCompare(b.displayName);
  });
}

/** Distinct statuses present, for the status filter. */
export function statusOptions(rows: readonly TenantUsageRow[]): string[] {
  return [...new Set(rows.map((r) => r.status))].sort();
}

/** The direction a column starts in when first clicked: names A→Z, numbers biggest first. */
export function defaultDir(key: UsageSortKey): SortDir {
  return key === 'name' ? 'asc' : 'desc';
}
