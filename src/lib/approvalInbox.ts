// Pure helpers for the Approvals inbox page.

import type { ApprovalInboxItem } from '@/types/approvalInbox';

export const APPROVALS_PATH = '/approvals';
export const APPROVALS_SCOPE_ALL_QUERY = 'scope=all';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Age thresholds (days) -- match the backend `approval_stuck` cadence. */
export const AGE_AMBER_DAYS = 2;
export const AGE_RED_DAYS = 5;

/** Page size for the list, and for the sidebar's count-only call. */
export const INBOX_PAGE_SIZE = 25;
export const INBOX_COUNT_LIMIT = 1;

export type AgeTone = 'neutral' | 'amber' | 'red';

/** Whole days an item has been waiting; never negative (clock skew) or NaN. */
export function waitingDays(waitingSince: string, now: Date = new Date()): number {
  const diff = now.getTime() - new Date(waitingSince).getTime();
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.floor(diff / DAY_MS);
}

export function ageTone(days: number): AgeTone {
  if (days >= AGE_RED_DAYS) return 'red';
  if (days >= AGE_AMBER_DAYS) return 'amber';
  return 'neutral';
}

/** "Waiting 3 days" / "Waiting 1 day" / "Waiting today" -- text, never colour alone. */
export function waitingLabel(days: number): string {
  if (days <= 0) return 'Waiting today';
  return `Waiting ${days} ${days === 1 ? 'day' : 'days'}`;
}

/** "1 of 2 approved". */
export function signOffLabel(item: Pick<ApprovalInboxItem, 'approvedCount' | 'requiredApprovals'>): string {
  return `${item.approvedCount} of ${item.requiredApprovals} approved`;
}

/** Currency-formatted amount, or null when absent so the row omits it. */
export function formatInboxAmount(amount: number | undefined, currency?: string): string | null {
  if (amount === undefined || amount === null) return null;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    // An unknown ISO code throws RangeError; fall back to USD rather than hide the figure.
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
}

/** Drill-through target for the dashboard tile; a super admin lands on every pending item. */
export function approvalsHref(isSuperAdmin: boolean): string {
  return isSuperAdmin ? `${APPROVALS_PATH}?${APPROVALS_SCOPE_ALL_QUERY}` : APPROVALS_PATH;
}
