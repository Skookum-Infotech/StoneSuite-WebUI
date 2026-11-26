// Platform › Tenant Usage — cross-tenant resource usage for platform admins.
// Mirrors the backend contract for GET /api/platform/usage/* (spec lives
// with the backend work in the StoneSuite repo). Sizes are bytes, compute is hours. A metric
// the backend has not measured yet is null, never 0.

import type { TokenUsageBySource } from '@/types/subscription';

export const USAGE_PERIODS = ['7d', '30d', '90d'] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

export type AlertSeverity = 'critical' | 'warning' | 'info';

/** Backend rule keys; an unknown key from a newer backend still renders. */
export type AlertRuleKey =
  | 'quota_exceeded'
  | 'quota_near'
  | 'spike'
  | 'rapid_growth'
  | 'fleet_outlier'
  | 'error_rate'
  | 'failed_jobs'
  | 'dormant';

export type AlertStatus = 'open' | 'acked' | 'snoozed' | 'resolved';

/** The metric an alert is about, so the detail page can flag its card. */
export type UsageMetricKey = 'compute' | 'db' | 'r2' | 'ai_tokens' | 'users' | 'requests' | 'error_rate' | 'jobs';

export interface UsageAlert {
  id: string;
  tenantId: string;
  tenantName: string;
  ruleKey: AlertRuleKey | string;
  metricKey: UsageMetricKey | string;
  severity: AlertSeverity;
  /** One-line, human-readable reason, e.g. "R2 storage up 211% in 7 days (132 GB → 410 GB)". */
  message: string;
  /** Optional supporting line (baseline, sample size). */
  detail?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  status: AlertStatus;
  /** Set when status is 'snoozed'. */
  snoozedUntil?: string | null;
}

/** One tenant's row in the overview list. "Prev" values cover the previous period of equal length. */
export interface TenantUsageRow {
  tenantId: string;
  slug: string;
  displayName: string;
  status: string;
  activeUsers: number;
  totalUsers: number;
  /** Estimated from metered request + background-job time. */
  computeHours: number | null;
  computeHoursPrev: number | null;
  dbBytes: number | null;
  dbBytesPrev: number | null;
  r2Bytes: number | null;
  r2BytesPrev: number | null;
  aiTokens: number | null;
  aiTokensPrev: number | null;
  /** 5xx share of requests over the period, as a percentage. */
  errorRatePct: number | null;
  /** 5xx share over the last 24 hours, as a percentage. */
  errorRate24hPct: number | null;
  /** Daily compute hours across the period, oldest first. */
  computeTrend: number[];
  /** Highest severity among the tenant's open alerts. */
  topSeverity: AlertSeverity | null;
}

export interface FleetTotals {
  activeTenants: number;
  totalTenants: number;
  computeHours: number;
  computeHoursPrev: number | null;
  dbBytes: number;
  dbBytesPrev: number | null;
  r2Bytes: number;
  r2BytesPrev: number | null;
  aiTokens: number;
  aiTokensPrev: number | null;
  /** Daily fleet compute hours across the period, oldest first. */
  computeTrend: number[];
}

export interface UsageOverview {
  generatedAt: string;
  period: UsagePeriod;
  fleet: FleetTotals;
  tenants: TenantUsageRow[];
}

/** One day of a tenant's usage. `date` is yyyy-mm-dd (UTC). */
export interface UsagePoint {
  date: string;
  computeRequestHours: number;
  computeJobHours: number;
  dbBytes: number;
  r2Bytes: number;
}

export interface TableSize {
  tableName: string;
  totalBytes: number;
  rowEstimate: number;
}

export interface TenantUsageMetrics {
  computeRequestHours: number;
  computeJobHours: number;
  /** This tenant's database size as a share of all tenant databases. */
  dbShareOfFleetPct: number | null;
  r2Objects: number | null;
  aiTokensBySource: TokenUsageBySource[];
  dauMauPct: number | null;
  lastSignInAt: string | null;
  requests: number;
  requestsPrev: number | null;
  p95LatencyMs: number | null;
  failedJobs: number;
  deadJobs: number;
}

export interface TenantActivity {
  recordsByModule: { label: string; count: number }[];
  emailsSent: number;
  automationRuns: number;
}

export interface TenantUsageDetail {
  generatedAt: string;
  period: UsagePeriod;
  tenant: TenantUsageRow;
  metrics: TenantUsageMetrics;
  series: UsagePoint[];
  topTables: TableSize[];
  topTablesMeasuredAt: string | null;
  activity: TenantActivity;
  /** Every alert from the last 90 days, open ones included, newest first. */
  alerts: UsageAlert[];
}

export type SnoozeDays = 7 | 30;

/** One headline card on the tenant detail page (built by lib/tenantUsageMetrics). */
export interface UsageMetric {
  label: string;
  value: string;
  /** Current and previous-period values, for the change pill. Omit to hide it. */
  change?: { now: number | null; prev: number | null };
  sub: string;
  spark?: number[];
  /** Severity of an open alert about this metric. */
  severity?: AlertSeverity;
  estimated?: boolean;
}
