// Pure formatters for the Subscription page's usage meters.

const BYTE_STEP = 1024;
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
const TOKEN_UNITS: { size: number; suffix: string }[] = [
  { size: 1_000_000_000, suffix: 'B' },
  { size: 1_000_000, suffix: 'M' },
  { size: 1_000, suffix: 'K' },
];
const PERCENT_MAX = 100;
const MS_PER_DAY = 86_400_000;
/** Below this many units a fraction is worth showing (1.5 GB, but 120 GB). */
const ONE_DECIMAL_BELOW = 100;

function trimmed(value: number): string {
  const fixed = value < ONE_DECIMAL_BELOW ? value.toFixed(1) : value.toFixed(0);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

/** Bytes in binary units: 512 B, 1.5 KB, 3.4 GB. Whole bytes stay unscaled. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= BYTE_STEP && unit < BYTE_UNITS.length - 1) {
    value /= BYTE_STEP;
    unit += 1;
  }
  return unit === 0 ? `${bytes} B` : `${trimmed(value)} ${BYTE_UNITS[unit]}`;
}

/** Compact token count: 950, 12.4K, 1.3M. */
export function formatTokenCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  const unit = TOKEN_UNITS.find((u) => n >= u.size);
  return unit ? `${trimmed(n / unit.size)}${unit.suffix}` : String(Math.round(n));
}

const COMPUTE_WHOLE_FROM = 100;
const COMPUTE_TWO_DECIMALS_BELOW = 10;

/** Compute hours: 0.42 h, 36.2 h, 318 h. Null (not measured) → "—". */
export function formatComputeHours(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours) || hours < 0) return '—';
  if (hours >= COMPUTE_WHOLE_FROM) return `${Math.round(hours).toLocaleString('en-US')} h`;
  return `${hours.toFixed(hours < COMPUTE_TWO_DECIMALS_BELOW ? 2 : 1)} h`;
}

/** Whole percent of limit used (capped at 100), or null when there is no limit. */
export function usagePercent(used: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null;
  return Math.min(PERCENT_MAX, Math.round((used / limit) * PERCENT_MAX));
}

function parseUtcDate(dateOnly: string): Date | null {
  const d = new Date(`${dateOnly}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const PERIOD_FORMAT: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', timeZone: 'UTC' };
const PERIOD_FORMAT_YEAR: Intl.DateTimeFormatOptions = { ...PERIOD_FORMAT, year: 'numeric' };

/**
 * Billing period label from the API's [start, end) dates: "20 Oct – 19 Nov 2026"
 * (the exclusive end shown as its last included day). Unparseable → "".
 */
export function formatPeriod(start: string, endExclusive: string): string {
  const s = parseUtcDate(start);
  const e = parseUtcDate(endExclusive);
  if (!s || !e) return '';
  const last = new Date(e.getTime() - MS_PER_DAY);
  const sameYear = s.getUTCFullYear() === last.getUTCFullYear();
  const from = s.toLocaleDateString('en-GB', sameYear ? PERIOD_FORMAT : PERIOD_FORMAT_YEAR);
  return `${from} – ${last.toLocaleDateString('en-GB', PERIOD_FORMAT_YEAR)}`;
}

/** Display names for the backend's token source keys. */
export const TOKEN_SOURCE_LABELS: Record<string, string> = {
  ask: 'Assistant chat',
  route: 'Assistant chat',
  doc_extract: 'Document extraction',
  report_interpret: 'Report builder',
  import: 'Data import',
  other: 'Other',
};

/** Token breakdown merged by display label (ask + route → Assistant chat), largest first. */
export function groupTokenSources(rows: { source: string; totalTokens: number }[]): { label: string; totalTokens: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const label = TOKEN_SOURCE_LABELS[row.source] ?? row.source;
    totals.set(label, (totals.get(label) ?? 0) + row.totalTokens);
  }
  return [...totals.entries()]
    .map(([label, totalTokens]) => ({ label, totalTokens }))
    .sort((a, b) => b.totalTokens - a.totalTokens);
}
