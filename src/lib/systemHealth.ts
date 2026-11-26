import type { AppHealth, HealthSnapshot, UsageLevel, UsagePart } from '@/types/systemHealth';

/** The watchdog runs hourly; older than this means it has stopped reporting. */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** Meter thresholds, matching the watchdog's warning / critical levels. */
export const METER_LOW = 80;
export const METER_HIGH = 95;
export const METER_MAX = 100;

export function isStale(snapshot: HealthSnapshot, nowMs: number): boolean {
  const at = Date.parse(snapshot.checkedAt);
  return Number.isNaN(at) || nowMs - at > STALE_AFTER_MS;
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function formatAge(iso: string | null, nowMs: number): string {
  if (!iso) return '—';
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return iso;
  const minutes = Math.max(0, Math.round((nowMs - at) / MS_PER_MINUTE));
  if (minutes < 1) return 'just now';
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min ago`;
  const hours = Math.round(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours} h ago`;
  const days = Math.round(hours / HOURS_PER_DAY);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** "110.36 / 100 CU-h (110.4%)", or a dash when Neon did not report it. */
export function formatUsage(part: UsagePart, unit: string): string {
  if (part.used === null || part.percent === null) return '—';
  return `${part.used} / ${part.limit} ${unit} (${part.percent}%)`;
}

/** Meter value, capped so an over-limit project still draws a full bar. */
export function meterValue(part: UsagePart): number {
  return Math.min(part.percent ?? 0, METER_MAX);
}

export const LEVEL_LABEL: Record<UsageLevel, string> = {
  unknown: 'Unknown',
  ok: 'OK',
  warning: 'Near limit',
  critical: 'Almost at limit',
  exceeded: 'Over limit',
};

export const LEVEL_CLASS: Record<UsageLevel, string> = {
  unknown: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  critical: 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
  exceeded: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

/** One-line state for an app: crashing wins, else its machines' states. */
export function appStateLabel(app: AppHealth): string {
  if (app.crashing) return 'Crashing';
  const states = [...new Set(app.machines.map((m) => m.state))];
  return states.length === 0 ? 'No machines' : states.join(', ');
}

/** Average minutes between wakes ("about every 15 min" points at a scheduler). */
export function wakeInterval(wakes: number | null): string {
  if (!wakes || wakes <= 0) return '—';
  return `every ~${Math.round((HOURS_PER_DAY * MINUTES_PER_HOUR) / wakes)} min`;
}

/** Apps sorted so the ones needing attention come first, then most awake. */
export function sortApps(apps: AppHealth[]): AppHealth[] {
  return [...apps].sort((a, b) => {
    if (a.crashing !== b.crashing) return a.crashing ? -1 : 1;
    return (b.awakeHours24h ?? 0) - (a.awakeHours24h ?? 0);
  });
}
