// Builds the eight headline cards on the Tenant Usage detail page from the
// API's detail payload. Pure, so the wording and the alert flags are tested
// without rendering.
import { formatBytes, formatComputeHours, formatTokenCount, groupTokenSources } from '@/lib/usageFormat';
import { SEVERITY_RANK } from '@/lib/usageWatchlist';
import type { AlertSeverity, TenantUsageDetail, UsageAlert, UsageMetric, UsagePeriod } from '@/types/platformUsage';

const PERIOD_DAYS: Record<UsagePeriod, number> = { '7d': 7, '30d': 30, '90d': 90 };
const PERCENT = 100;
const MS_PER_DAY = 86_400_000;
/** A tenant with no sign-in for this many days gets "last sign-in N days ago". */
const QUIET_SIGN_IN_DAYS = 7;
const TOP_TOKEN_SOURCES = 2;

/** Most severe open alert per metric key. */
export function severityByMetric(alerts: readonly UsageAlert[]): Partial<Record<string, AlertSeverity>> {
  const out: Partial<Record<string, AlertSeverity>> = {};
  for (const a of alerts) {
    const cur = out[a.metricKey];
    if (!cur || SEVERITY_RANK[a.severity] < SEVERITY_RANK[cur]) out[a.metricKey] = a.severity;
  }
  return out;
}

const pct = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * PERCENT) : 0);

function tokenSub(detail: TenantUsageDetail): string {
  const groups = groupTokenSources(detail.metrics.aiTokensBySource);
  const total = groups.reduce((acc, g) => acc + g.totalTokens, 0);
  if (total === 0) return 'No AI use this period';
  return groups
    .slice(0, TOP_TOKEN_SOURCES)
    .map((g) => `${g.label} ${pct(g.totalTokens, total)}%`)
    .join(' · ');
}

function usersSub(detail: TenantUsageDetail, now: Date): string {
  const parts: string[] = [];
  if (detail.metrics.dauMauPct !== null) parts.push(`DAU/MAU ${Math.round(detail.metrics.dauMauPct)}%`);
  const last = detail.metrics.lastSignInAt;
  if (last) {
    const days = Math.floor((now.getTime() - new Date(last).getTime()) / MS_PER_DAY);
    if (days >= QUIET_SIGN_IN_DAYS) parts.push(`last sign-in ${days} days ago`);
  } else {
    parts.push('no sign-ins yet');
  }
  return parts.join(' · ');
}

export function buildUsageMetrics(detail: TenantUsageDetail, openAlerts: readonly UsageAlert[], now: Date = new Date()): UsageMetric[] {
  const { tenant: t, metrics: m, series } = detail;
  const flag = severityByMetric(openAlerts);
  const compute = m.computeRequestHours + m.computeJobHours;
  const days = PERIOD_DAYS[detail.period];
  const jobs = m.deadJobs + m.failedJobs > 0 ? `${m.deadJobs} dead, ${m.failedJobs} failed jobs` : 'No failed jobs';

  return [
    {
      label: 'Compute',
      estimated: true,
      value: formatComputeHours(t.computeHours),
      change: { now: t.computeHours, prev: t.computeHoursPrev },
      sub: `Requests ${pct(m.computeRequestHours, compute)}% · jobs ${pct(m.computeJobHours, compute)}%`,
      spark: series.map((p) => p.computeRequestHours + p.computeJobHours),
      severity: flag.compute,
    },
    {
      label: 'Database storage',
      value: t.dbBytes === null ? '—' : formatBytes(t.dbBytes),
      change: { now: t.dbBytes, prev: t.dbBytesPrev },
      sub: m.dbShareOfFleetPct === null ? 'Not measured yet' : `${m.dbShareOfFleetPct.toFixed(1)}% of all tenant data`,
      spark: series.map((p) => p.dbBytes),
      severity: flag.db,
    },
    {
      label: 'R2 storage',
      value: t.r2Bytes === null ? '—' : formatBytes(t.r2Bytes),
      change: { now: t.r2Bytes, prev: t.r2BytesPrev },
      sub: m.r2Objects === null ? 'Not measured yet' : `${formatTokenCount(m.r2Objects)} objects`,
      spark: series.map((p) => p.r2Bytes),
      severity: flag.r2,
    },
    {
      label: 'AI tokens',
      value: t.aiTokens === null ? '—' : formatTokenCount(t.aiTokens),
      change: { now: t.aiTokens, prev: t.aiTokensPrev },
      sub: tokenSub(detail),
      severity: flag.ai_tokens,
    },
    {
      label: 'Active users',
      value: `${t.activeUsers} / ${t.totalUsers}`,
      sub: usersSub(detail, now),
      severity: flag.users,
    },
    {
      label: 'API requests',
      value: formatTokenCount(m.requests),
      change: { now: m.requests, prev: m.requestsPrev },
      sub: `${Math.round(m.requests / days).toLocaleString('en-US')} a day on average`,
      severity: flag.requests,
    },
    {
      label: 'Error rate',
      value: t.errorRatePct === null ? '—' : `${t.errorRatePct.toFixed(2)}%`,
      sub: t.errorRate24hPct === null ? 'Server errors (5xx)' : `Last 24 hours: ${t.errorRate24hPct.toFixed(1)}%`,
      severity: flag.error_rate,
    },
    {
      label: 'p95 latency',
      value: m.p95LatencyMs === null ? '—' : `${Math.round(m.p95LatencyMs)} ms`,
      sub: jobs,
      severity: flag.jobs,
    },
  ];
}
