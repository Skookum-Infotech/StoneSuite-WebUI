import { describe, it, expect } from 'vitest';
import type { TenantUsageDetail, UsageAlert } from '@/types/platformUsage';
import { buildUsageMetrics, severityByMetric } from './tenantUsageMetrics';

const NOW = new Date('2026-11-25T00:00:00Z');
const GB = 1024 ** 3;

function detail(overrides: Partial<TenantUsageDetail> = {}): TenantUsageDetail {
  return {
    generatedAt: '2026-11-25T02:10:00Z',
    period: '30d',
    tenant: {
      tenantId: 't-1', slug: 'acme', displayName: 'Acme', status: 'active', activeUsers: 34, totalUsers: 40,
      computeHours: 36.2, computeHoursPrev: 35, dbBytes: 6.2 * GB, dbBytesPrev: 6 * GB, r2Bytes: 410 * GB, r2BytesPrev: 132 * GB,
      aiTokens: 1_800_000, aiTokensPrev: 1_700_000, errorRatePct: 0.39, errorRate24hPct: 0.4, computeTrend: [1, 2], topSeverity: 'critical',
    },
    metrics: {
      computeRequestHours: 26.1, computeJobHours: 10.1, dbShareOfFleetPct: 17.6, r2Objects: 1_820_000,
      aiTokensBySource: [
        { source: 'ask', totalTokens: 600 },
        { source: 'route', totalTokens: 10 },
        { source: 'doc_extract', totalTokens: 240 },
        { source: 'import', totalTokens: 150 },
      ],
      dauMauPct: 62, lastSignInAt: '2026-11-24T10:00:00Z', requests: 153_500, requestsPrev: 146_600,
      p95LatencyMs: 232, failedJobs: 0, deadJobs: 0,
    },
    series: [
      { date: '2026-11-24', computeRequestHours: 1, computeJobHours: 0.5, dbBytes: GB, r2Bytes: 2 * GB },
      { date: '2026-11-25', computeRequestHours: 2, computeJobHours: 1, dbBytes: GB, r2Bytes: 3 * GB },
    ],
    topTables: [],
    topTablesMeasuredAt: null,
    activity: { recordsByModule: [], emailsSent: 0, automationRuns: 0 },
    alerts: [],
    ...overrides,
  };
}

function alert(metricKey: string, severity: UsageAlert['severity']): UsageAlert {
  return {
    id: `${metricKey}-${severity}`, tenantId: 't-1', tenantName: 'Acme', ruleKey: 'spike', metricKey, severity,
    message: 'm', firstSeenAt: '2026-11-01T00:00:00Z', lastSeenAt: '2026-11-25T00:00:00Z', status: 'open',
  };
}

const byLabel = (d: TenantUsageDetail, alerts: UsageAlert[] = []) =>
  Object.fromEntries(buildUsageMetrics(d, alerts, NOW).map((m) => [m.label, m]));

describe('buildUsageMetrics', () => {
  it('builds the eight cards in display order', () => {
    expect(buildUsageMetrics(detail(), [], NOW).map((m) => m.label)).toEqual([
      'Compute', 'Database storage', 'R2 storage', 'AI tokens', 'Active users', 'API requests', 'Error rate', 'p95 latency',
    ]);
  });

  it.each([
    ['Compute', '36.2 h', 'Requests 72% · jobs 28%'],
    ['Database storage', '6.2 GB', '17.6% of all tenant data'],
    ['R2 storage', '410 GB', '1.8M objects'],
    ['AI tokens', '1.8M', 'Assistant chat 61% · Document extraction 24%'],
    ['Active users', '34 / 40', 'DAU/MAU 62%'],
    ['API requests', '154K', '5,117 a day on average'],
    ['Error rate', '0.39%', 'Last 24 hours: 0.4%'],
    ['p95 latency', '232 ms', 'No failed jobs'],
  ])('%s shows %s with "%s"', (label, value, sub) => {
    const card = byLabel(detail())[label];
    expect(card.value).toBe(value);
    expect(card.sub).toBe(sub);
  });

  it('marks compute as estimated and gives it a sparkline of daily totals', () => {
    const card = byLabel(detail()).Compute;
    expect(card.estimated).toBe(true);
    expect(card.spark).toEqual([1.5, 3]);
  });

  it('flags the card an open alert is about', () => {
    const cards = byLabel(detail(), [alert('r2', 'critical'), alert('jobs', 'warning')]);
    expect(cards['R2 storage'].severity).toBe('critical');
    expect(cards['p95 latency'].severity).toBe('warning');
    expect(cards.Compute.severity).toBeUndefined();
  });

  it('says how long ago a quiet tenant last signed in', () => {
    const d = detail();
    const quiet = { ...d, metrics: { ...d.metrics, dauMauPct: 0, lastSignInAt: '2026-11-04T00:00:00Z' } };
    expect(byLabel(quiet)['Active users'].sub).toBe('DAU/MAU 0% · last sign-in 21 days ago');
  });

  it('shows dashes for unmeasured values', () => {
    const d = detail();
    const empty = {
      ...d,
      tenant: { ...d.tenant, dbBytes: null, r2Bytes: null, aiTokens: null, errorRatePct: null, errorRate24hPct: null },
      metrics: { ...d.metrics, dbShareOfFleetPct: null, r2Objects: null, p95LatencyMs: null, aiTokensBySource: [], lastSignInAt: null, dauMauPct: null },
    };
    const cards = byLabel(empty);
    expect(cards['Database storage'].value).toBe('—');
    expect(cards['Database storage'].sub).toBe('Not measured yet');
    expect(cards['AI tokens'].sub).toBe('No AI use this period');
    expect(cards['Active users'].sub).toBe('no sign-ins yet');
    expect(cards['p95 latency'].value).toBe('—');
  });
});

describe('severityByMetric', () => {
  it('keeps the most severe alert per metric', () => {
    expect(severityByMetric([alert('r2', 'info'), alert('r2', 'critical'), alert('db', 'warning')])).toEqual({
      r2: 'critical',
      db: 'warning',
    });
  });
});
