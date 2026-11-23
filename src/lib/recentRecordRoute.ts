// Pure helpers for the dashboard widgets' record links and relative dates.

import { fromISODate } from './dateUtils';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_WINDOW_DAYS = 7;

/**
 * Builds a Recent Records row's detail-page link from its backend-supplied
 * domain + module (see dashboardData.ts's RecentRecord). These deliberately
 * mirror the router's own path segments 1:1 -- crm/lead, sales/sales_order,
 * purchases/vendor_bill, ... (see router/index.tsx) -- so no per-module
 * lookup table is needed here; a module added to both sides just works.
 */
export function recordRoute(domain: string, module: string, id: string): string {
  return `/${domain}/${module}/${id}`;
}

/**
 * Formats an ISO timestamp as a short "Xm/Xh/Xd ago" label, matching the
 * dashboard's existing compact style. Falls back to a calendar date once the
 * gap exceeds a week, so a genuinely old row doesn't read as a vague
 * "52w ago", and to an em dash for an unparseable timestamp.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  if (Number.isNaN(diffMs)) return '—';
  if (diffMs < MINUTE_MS) return 'just now';
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)}m ago`;
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)}h ago`;
  const days = Math.floor(diffMs / DAY_MS);
  if (days < RELATIVE_WINDOW_DAYS) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Calendar-day counterpart of relativeTime for date-only values (a Postgres
 * DATE as `yyyy-mm-dd`), where "2h ago" would be meaningless: "Today",
 * "Yesterday" or "Nd ago" inside the same one-week window, otherwise the
 * short date. Days are counted between local midnights, rounded so a DST
 * day of 23 or 25 hours still counts as one. A future date shows its date
 * rather than a negative count; an unparseable one shows an em dash.
 */
export function relativeDay(dateOnly: string, now: Date = new Date()): string {
  const then = fromISODate(dateOnly);
  if (!then) return '—';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - then.getTime()) / DAY_MS);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < RELATIVE_WINDOW_DAYS) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
