// Sample data for Platform › Tenant Usage, served by platformUsageService when
// the build sets VITE_PLATFORM_USAGE_MOCK=true (until the backend ships the
// /platform/usage endpoints). Deterministic: the same tenant always gets the
// same numbers, so screenshots and demos are stable.
import type {
  SnoozeDays,
  TenantUsageDetail,
  TenantUsageRow,
  UsageAlert,
  UsageOverview,
  UsagePeriod,
  UsagePoint,
} from '@/types/platformUsage';
import { activeAlerts, highestSeverity } from '@/lib/usageWatchlist';

const GB = 1024 ** 3;
const DAY_MS = 86_400_000;
const HISTORY_DAYS = 180;
const PERIOD_DAYS: Record<UsagePeriod, number> = { '7d': 7, '30d': 30, '90d': 90 };
const NOW = Date.UTC(2026, 10, 25, 2, 10);
const WEEKEND_FACTOR = 0.45;
const JOB_SHARE = 0.28;
const GROWTH_FLOOR = 0.8;
const NOISE_SPAN = 0.3;
const NOISE_FLOOR = 0.85;
const ERROR_SPIKE_PCT = 7.8;
const ERROR_SPIKE_DAYS = 2;
const DORMANT_DAYS = 21;
const R2_JUMP_DAYS = 7;
const R2_JUMP_TO_GB = 410;

type Pattern = 'steady' | 'r2jump' | 'errors' | 'heavy' | 'jobs' | 'dormant' | 'suspended' | 'pending';

interface SampleTenant {
  id: string; slug: string; name: string; status: string; users: number; totalUsers: number; dauMau: number;
  computePerDay: number; dbGb: number; r2Gb: number; objects: number; aiPerDay: number; reqPerDay: number;
  errPct: number; p95: number; pattern: Pattern;
}

function t(id: string, name: string, status: string, n: number[], pattern: Pattern): SampleTenant {
  const [users, totalUsers, dauMau, computePerDay, dbGb, r2Gb, objects, aiPerDay, reqPerDay, errPct, p95] = n;
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  return { id, slug, name, status, users, totalUsers, dauMau, computePerDay, dbGb, r2Gb, objects, aiPerDay, reqPerDay, errPct, p95, pattern };
}

// users, totalUsers, dau/mau %, compute h/day, db GB, r2 GB, objects, AI tokens/day, requests/day, error %, p95 ms
const TENANTS: SampleTenant[] = [
  t('t-acme', 'Acme Stone', 'active', [34, 40, 62, 1.45, 6.2, 132, 1.82e6, 72_000, 6100, 0.4, 240], 'r2jump'),
  t('t-quarry', 'Quarry Works', 'active', [22, 25, 58, 0.66, 5.1, 61, 4.1e5, 31_000, 3150, 0.5, 300], 'errors'),
  t('t-granite', 'Granite Co', 'active', [12, 15, 71, 1.32, 3.9, 88, 6.6e5, 48_000, 5200, 0.2, 280], 'heavy'),
  t('t-slab', 'Slab House', 'active', [14, 20, 49, 0.52, 2.4, 34, 2.2e5, 12_500, 2100, 0.3, 210], 'jobs'),
  t('t-marble', 'Marble Inc', 'active', [0, 10, 0, 0.18, 0.4, 2.1, 1e4, 3000, 420, 0.1, 150], 'dormant'),
  t('t-bluestone', 'Bluestone Kitchens', 'active', [27, 30, 66, 0.92, 4.6, 120, 9.3e5, 52_000, 4800, 0.3, 230], 'steady'),
  t('t-summit', 'Summit Surfaces', 'active', [41, 50, 60, 1.62, 9.8, 214, 2.4e6, 91_000, 9300, 0.5, 260], 'steady'),
  t('t-coastal', 'Coastal Quartz', 'active', [11, 12, 64, 0.36, 1.8, 41, 2.9e5, 15_000, 1700, 0.2, 190], 'steady'),
  t('t-ridgeline', 'Ridgeline Tile', 'suspended', [0, 8, 0, 0.28, 1.1, 18, 1.2e5, 6000, 900, 0.2, 200], 'suspended'),
  t('t-newtile', 'NewTile Studio', 'pending', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'pending'),
];

const iso = (daysAgo: number): string => new Date(NOW - daysAgo * DAY_MS).toISOString();

const ALERTS: UsageAlert[] = [
  alert('a-1', 't-acme', 'critical', 'rapid_growth', 'r2', 'R2 storage up 211% in 7 days (132 GB → 410 GB)', 'Usual growth is about 1% a week. Mostly new PDF and image uploads.', 6),
  alert('a-2', 't-quarry', 'critical', 'error_rate', 'error_rate', 'Server error rate 7.8% over the last 24 hours', '3.1k requests, 242 failed. Usual rate is 0.5%.', 1),
  alert('a-3', 't-granite', 'warning', 'fleet_outlier', 'compute', 'Compute per active user is 4.1× the fleet median', "Above the fleet's 95th percentile for 14 days.", 14),
  alert('a-4', 't-slab', 'warning', 'failed_jobs', 'jobs', '2 dead background jobs in the last 24 hours', 'Document import jobs reached their 5 attempts.', 0),
  alert('a-5', 't-marble', 'info', 'dormant', 'users', 'No sign-ins for 21 days', '10 users, none active. Possible churn risk.', 21),
  { ...alert('a-6', 't-acme', 'warning', 'spike', 'compute', 'Compute 3.4× its 7-day median', undefined, 54), status: 'resolved' },
  { ...alert('a-7', 't-granite', 'warning', 'rapid_growth', 'db', 'Database up 64% in 7 days (2.1 GB → 3.4 GB)', undefined, 68), status: 'acked' },
];

function alert(id: string, tenantId: string, severity: UsageAlert['severity'], ruleKey: string, metricKey: string, message: string, detail: string | undefined, daysAgo: number): UsageAlert {
  const tenantName = TENANTS.find((x) => x.id === tenantId)?.name ?? tenantId;
  return { id, tenantId, tenantName, severity, ruleKey, metricKey, message, detail, firstSeenAt: iso(daysAgo), lastSeenAt: iso(0), status: 'open' };
}

/** Small seeded PRNG (mulberry32) so every tenant has stable noise. */
function rng(seedText: string): () => number {
  let seed = [...seedText].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16_777_619), 2_166_136_261);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface Day extends UsagePoint { ai: number; req: number; errPct: number }

function history(s: SampleTenant): Day[] {
  const rand = rng(s.slug);
  const days: Day[] = [];
  for (let i = 0; i < HISTORY_DAYS; i += 1) {
    const daysAgo = HISTORY_DAYS - 1 - i;
    const date = new Date(NOW - daysAgo * DAY_MS);
    const weekday = date.getUTCDay() % 6 === 0 ? WEEKEND_FACTOR : 1;
    const growth = GROWTH_FLOOR + (1 - GROWTH_FLOOR) * (i / (HISTORY_DAYS - 1));
    const on = (s.pattern === 'dormant' && daysAgo < DORMANT_DAYS) || s.pattern === 'suspended' && daysAgo < 35 ? 0.02 : 1;
    const noise = (): number => NOISE_FLOOR + rand() * NOISE_SPAN;
    const compute = s.computePerDay * weekday * growth * on * noise();
    const jobBoost = s.pattern === 'jobs' && daysAgo < 3 ? 2.4 : 1;
    let r2 = s.r2Gb * (GROWTH_FLOOR + (1 - GROWTH_FLOOR) * (i / (HISTORY_DAYS - 1)));
    if (s.pattern === 'r2jump') {
      r2 = daysAgo > R2_JUMP_DAYS ? s.r2Gb * (0.86 + 0.14 * (i / (HISTORY_DAYS - 1 - R2_JUMP_DAYS)))
        : s.r2Gb + (R2_JUMP_TO_GB - s.r2Gb) * ((R2_JUMP_DAYS - daysAgo) / R2_JUMP_DAYS) ** 1.3;
    }
    days.push({
      date: date.toISOString().slice(0, 10),
      computeRequestHours: compute * (1 - JOB_SHARE),
      computeJobHours: compute * JOB_SHARE * jobBoost,
      dbBytes: s.dbGb * (0.82 + 0.18 * (i / (HISTORY_DAYS - 1))) * GB,
      r2Bytes: r2 * GB,
      ai: s.aiPerDay * weekday * growth * on * noise(),
      req: s.reqPerDay * weekday * growth * on * noise(),
      errPct: s.pattern === 'errors' && daysAgo < ERROR_SPIKE_DAYS ? ERROR_SPIKE_PCT : s.errPct * noise(),
    });
  }
  return days;
}

const sum = (days: Day[], pick: (d: Day) => number): number => days.reduce((acc, d) => acc + pick(d), 0);
const compute = (d: Day): number => d.computeRequestHours + d.computeJobHours;

function row(s: SampleTenant, period: UsagePeriod): TenantUsageRow {
  const base = { tenantId: s.id, slug: s.slug, displayName: s.name, status: s.status, activeUsers: s.users, totalUsers: s.totalUsers };
  const topSeverity = highestSeverity(activeAlerts(state.alerts.filter((a) => a.tenantId === s.id)));
  if (s.pattern === 'pending') {
    return { ...base, computeHours: null, computeHoursPrev: null, dbBytes: null, dbBytesPrev: null, r2Bytes: null, r2BytesPrev: null, aiTokens: null, aiTokensPrev: null, errorRatePct: null, errorRate24hPct: null, computeTrend: [], topSeverity };
  }
  const n = PERIOD_DAYS[period];
  const all = history(s);
  const cur = all.slice(-n);
  const prev = all.slice(-2 * n, -n);
  const req = sum(cur, (d) => d.req);
  return {
    ...base,
    computeHours: sum(cur, compute),
    computeHoursPrev: sum(prev, compute),
    dbBytes: cur[cur.length - 1].dbBytes,
    dbBytesPrev: prev[prev.length - 1].dbBytes,
    r2Bytes: cur[cur.length - 1].r2Bytes,
    r2BytesPrev: prev[prev.length - 1].r2Bytes,
    aiTokens: sum(cur, (d) => d.ai),
    aiTokensPrev: sum(prev, (d) => d.ai),
    errorRatePct: req > 0 ? sum(cur, (d) => d.errPct * d.req) / req : 0,
    errorRate24hPct: cur[cur.length - 1].errPct,
    computeTrend: cur.map(compute),
    topSeverity,
  };
}

const state: { alerts: UsageAlert[] } = { alerts: ALERTS.map((a) => ({ ...a })) };

const total = (rows: TenantUsageRow[], pick: (r: TenantUsageRow) => number | null): number =>
  rows.reduce((acc, r) => acc + (pick(r) ?? 0), 0);

export function mockOverview(period: UsagePeriod): UsageOverview {
  const tenants = TENANTS.map((s) => row(s, period));
  const measured = tenants.filter((r) => r.computeTrend.length > 0);
  const trendLength = measured[0]?.computeTrend.length ?? 0;
  return {
    generatedAt: new Date(NOW).toISOString(),
    period,
    tenants,
    fleet: {
      activeTenants: tenants.filter((r) => r.status === 'active').length,
      totalTenants: tenants.length,
      computeHours: total(tenants, (r) => r.computeHours),
      computeHoursPrev: total(tenants, (r) => r.computeHoursPrev),
      dbBytes: total(tenants, (r) => r.dbBytes),
      dbBytesPrev: total(tenants, (r) => r.dbBytesPrev),
      r2Bytes: total(tenants, (r) => r.r2Bytes),
      r2BytesPrev: total(tenants, (r) => r.r2BytesPrev),
      aiTokens: total(tenants, (r) => r.aiTokens),
      aiTokensPrev: total(tenants, (r) => r.aiTokensPrev),
      computeTrend: Array.from({ length: trendLength }, (_, i) => total(measured, (r) => r.computeTrend[i])),
    },
  };
}

export function mockWatchlist(): UsageAlert[] {
  return activeAlerts(state.alerts).map((a) => ({ ...a }));
}

const TABLES = ['email_log', 'attachments_meta', 'audit_log', 'invoices', 'crm_records'];
const TABLE_SHARES = [0.24, 0.21, 0.19, 0.14, 0.12];
const MODULES = ['Sales Orders', 'Invoices', 'Leads', 'Quotes', 'Inventory units'];
const MODULE_SHARES = [0.033, 0.029, 0.025, 0.014, 0.012];

/** Null when the tenant id is unknown (the real API answers 404). */
export function mockTenantUsage(tenantId: string, period: UsagePeriod): TenantUsageDetail | null {
  const s = TENANTS.find((x) => x.id === tenantId);
  if (!s) return null;
  const tenant = row(s, period);
  const n = PERIOD_DAYS[period];
  const all = s.pattern === 'pending' ? [] : history(s);
  const cur = all.slice(-n);
  const requests = sum(cur, (d) => d.req);
  const fleetDb = total(TENANTS.map((x) => row(x, period)), (r) => r.dbBytes);
  return {
    generatedAt: new Date(NOW).toISOString(),
    period,
    tenant,
    metrics: {
      computeRequestHours: sum(cur, (d) => d.computeRequestHours),
      computeJobHours: sum(cur, (d) => d.computeJobHours),
      dbShareOfFleetPct: tenant.dbBytes && fleetDb ? (tenant.dbBytes / fleetDb) * 100 : null,
      r2Objects: s.objects || null,
      aiTokensBySource: [
        { source: 'ask', totalTokens: (tenant.aiTokens ?? 0) * 0.61 },
        { source: 'doc_extract', totalTokens: (tenant.aiTokens ?? 0) * 0.24 },
        { source: 'report_interpret', totalTokens: (tenant.aiTokens ?? 0) * 0.15 },
      ],
      dauMauPct: s.pattern === 'pending' ? null : s.dauMau,
      lastSignInAt: s.pattern === 'pending' ? null : iso(s.pattern === 'dormant' ? DORMANT_DAYS : 0),
      requests,
      requestsPrev: sum(all.slice(-2 * n, -n), (d) => d.req),
      p95LatencyMs: s.p95 || null,
      failedJobs: s.pattern === 'jobs' ? 3 : 0,
      deadJobs: s.pattern === 'jobs' ? 2 : 0,
    },
    series: cur.map(({ date, computeRequestHours, computeJobHours, dbBytes, r2Bytes }) => ({ date, computeRequestHours, computeJobHours, dbBytes, r2Bytes })),
    topTables: TABLES.map((tableName, i) => ({ tableName, totalBytes: (tenant.dbBytes ?? 0) * TABLE_SHARES[i], rowEstimate: Math.round(s.reqPerDay * 500 * TABLE_SHARES[i]) })).filter((x) => x.totalBytes > 0),
    topTablesMeasuredAt: s.pattern === 'pending' ? null : new Date(NOW).toISOString(),
    activity: {
      recordsByModule: MODULES.map((label, i) => ({ label, count: Math.round(requests * MODULE_SHARES[i]) })),
      emailsSent: Math.round(requests * 0.05),
      automationRuns: Math.round(requests * 0.024),
    },
    alerts: state.alerts.filter((a) => a.tenantId === s.id).sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt)),
  };
}

/** Acknowledge (no snooze) or snooze an alert; false when the id is unknown. */
export function mockAckAlert(alertId: string, snoozeDays?: SnoozeDays): boolean {
  const target = state.alerts.find((a) => a.id === alertId);
  if (!target) return false;
  state.alerts = state.alerts.map((a) =>
    a.id === alertId
      ? { ...a, status: snoozeDays ? 'snoozed' : 'acked', snoozedUntil: snoozeDays ? new Date(Date.now() + snoozeDays * DAY_MS).toISOString() : null }
      : a,
  );
  return true;
}
