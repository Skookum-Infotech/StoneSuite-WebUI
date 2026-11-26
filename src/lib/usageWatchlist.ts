// Pure helpers for the Tenant Usage watch list: severity ordering, labels and
// the period-over-period change shown beside each metric.
import type { AlertRuleKey, AlertSeverity, UsageAlert } from '@/types/platformUsage';

export const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

/** Pill colours per severity (light + dark). Literal strings so Tailwind keeps them. */
export const SEVERITY_PILL_CLASS: Record<AlertSeverity, string> = {
  critical: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  info: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
};

/** The left stripe on a watch-list row and the status dot in the table. */
export const SEVERITY_DOT_CLASS: Record<AlertSeverity, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

const RULE_LABEL: Record<AlertRuleKey, string> = {
  quota_exceeded: 'Over quota',
  quota_near: 'Near quota',
  spike: 'Usage spike',
  rapid_growth: 'Rapid growth',
  fleet_outlier: 'Fleet outlier',
  error_rate: 'Error rate',
  failed_jobs: 'Failed jobs',
  dormant: 'Dormant',
};

/** Display name for a rule key; an unknown key from a newer backend is prettified. */
export function ruleLabel(ruleKey: string): string {
  const known = RULE_LABEL[ruleKey as AlertRuleKey];
  if (known) return known;
  const words = ruleKey.replace(/_/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Alert';
}

/** Most severe first, then the most recently seen. Returns a new array. */
export function sortAlerts(alerts: readonly UsageAlert[]): UsageAlert[] {
  return [...alerts].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.lastSeenAt.localeCompare(a.lastSeenAt),
  );
}

/** Alerts that still need attention (open, or snoozed past their snooze date). */
export function activeAlerts(alerts: readonly UsageAlert[], now: Date = new Date()): UsageAlert[] {
  return alerts.filter(
    (a) =>
      a.status === 'open' ||
      (a.status === 'snoozed' && Boolean(a.snoozedUntil) && new Date(a.snoozedUntil ?? 0).getTime() <= now.getTime()),
  );
}

/** The single most severe severity in a list, or null when it is empty. */
export function highestSeverity(alerts: readonly UsageAlert[]): AlertSeverity | null {
  let best: AlertSeverity | null = null;
  for (const a of alerts) {
    if (best === null || SEVERITY_RANK[a.severity] < SEVERITY_RANK[best]) best = a.severity;
  }
  return best;
}

const PERCENT = 100;

/** Percent change from prev to now, or null when there is no usable baseline. */
export function percentChange(now: number | null, prev: number | null): number | null {
  if (now === null || prev === null || prev <= 0 || !Number.isFinite(now) || !Number.isFinite(prev)) return null;
  return ((now - prev) / prev) * PERCENT;
}

/** A change at or above this is called out in the warning colour. */
export const NOTABLE_CHANGE_PCT = 50;
const ONE_DECIMAL_BELOW_PCT = 10;

/** "+3.1%", "-12%", or "—" when there is no change to show. */
export function formatChange(change: number | null): string {
  if (change === null) return '—';
  const abs = Math.abs(change);
  const text = abs < ONE_DECIMAL_BELOW_PCT ? abs.toFixed(1) : abs.toFixed(0);
  return `${change >= 0 ? '+' : '-'}${text}%`;
}
