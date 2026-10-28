import { describe, it, expect } from 'vitest';
import {
  ANOMALY_FILTERS,
  ANOMALY_PAGE_SIZE,
  anomalyRuleLabel,
  buildAnomalyParams,
  findAnomalyScanRule,
  scanSummary,
  reviewActions,
  sortAnomalies,
} from './anomaly';
import type { Anomaly, AnomalySeverity, AnomalyStatus } from '@/types/anomaly';

function make(id: string, severity: AnomalySeverity, detectedAt: string): Anomaly {
  return {
    id,
    ruleKey: 'self_approval',
    severity,
    resource: 'invoice',
    title: id,
    detail: '',
    status: 'open',
    note: '',
    detectedAt,
  };
}

describe('sortAnomalies', () => {
  it('puts criticals first, then newest first within each severity', () => {
    const input = [
      make('old-warn', 'warning', '2026-10-01T00:00:00Z'),
      make('new-info', 'info', '2026-10-27T00:00:00Z'),
      make('old-crit', 'critical', '2026-10-02T00:00:00Z'),
      make('new-warn', 'warning', '2026-10-26T00:00:00Z'),
      make('new-crit', 'critical', '2026-10-25T00:00:00Z'),
    ];
    expect(sortAnomalies(input).map((a) => a.id)).toEqual([
      'new-crit',
      'old-crit',
      'new-warn',
      'old-warn',
      'new-info',
    ]);
  });

  it('does not mutate its input', () => {
    const input = [make('a', 'info', '2026-10-01T00:00:00Z'), make('b', 'critical', '2026-10-01T00:00:00Z')];
    sortAnomalies(input);
    expect(input.map((a) => a.id)).toEqual(['a', 'b']);
  });
});

describe('buildAnomalyParams', () => {
  const cases = [
    { name: 'a status tab sends the status', filter: 'open', cursor: '', want: { limit: ANOMALY_PAGE_SIZE, status: 'open' } },
    { name: 'all omits the status', filter: 'all', cursor: '', want: { limit: ANOMALY_PAGE_SIZE } },
    { name: 'a cursor is replayed as given', filter: 'dismissed', cursor: 'abc', want: { limit: ANOMALY_PAGE_SIZE, status: 'dismissed', cursor: 'abc' } },
    { name: 'an empty cursor is omitted', filter: 'reviewed', cursor: '', want: { limit: ANOMALY_PAGE_SIZE, status: 'reviewed' } },
  ] as const;
  it.each(cases)('$name', ({ filter, cursor, want }) => {
    expect(buildAnomalyParams(filter, cursor)).toEqual(want);
  });
});

describe('reviewActions', () => {
  const cases: Array<{ status: AnomalyStatus; want: string[] }> = [
    { status: 'open', want: ['reviewed', 'confirmed', 'dismissed'] },
    { status: 'reviewed', want: ['confirmed', 'dismissed', 'open'] },
    { status: 'confirmed', want: ['open'] },
    { status: 'dismissed', want: ['open'] },
  ];
  it.each(cases)('offers $want from $status', ({ status, want }) => {
    expect(reviewActions(status).map((a) => a.to)).toEqual(want);
  });

  it('never offers the status a finding is already in', () => {
    for (const { value } of ANOMALY_FILTERS) {
      if (value === 'all') continue;
      expect(reviewActions(value).map((a) => a.to)).not.toContain(value);
    }
  });
});

describe('anomalyRuleLabel', () => {
  const cases = [
    { key: 'self_approval', want: 'Approved by its own owner' },
    { key: 'unbalanced_journal', want: 'Unbalanced journal entry' },
    { key: 'duplicate_vendor_bill', want: 'Possible duplicate vendor bill' },
    { key: 'high_discount', want: 'Unusually high discount' },
    { key: 'posted_in_closed_period', want: 'Posted into a closed period' },
    { key: 'brand_new_rule', want: 'Brand new rule' },
    { key: '', want: 'Anomaly' },
  ];
  it.each(cases)('labels "$key"', ({ key, want }) => {
    expect(anomalyRuleLabel(key)).toBe(want);
  });
});

describe('ANOMALY_FILTERS', () => {
  it('lists every status exactly once, plus all', () => {
    const values = ANOMALY_FILTERS.map((f) => f.value);
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort()).toEqual(['all', 'confirmed', 'dismissed', 'open', 'reviewed']);
  });
});

describe('findAnomalyScanRule', () => {
  const base = { name: 'x', audience: 'internal', enabled: true, enabledAt: null } as const;
  it('finds the scan switch among the workspace rules', () => {
    const rules = [{ ...base, ruleKey: 'ar_dunning' }, { ...base, ruleKey: 'anomaly_scan' }];
    expect(findAnomalyScanRule(rules)?.ruleKey).toBe('anomaly_scan');
  });
  it('returns undefined when the workspace has none', () => {
    expect(findAnomalyScanRule([{ ...base, ruleKey: 'ar_dunning' }])).toBeUndefined();
    expect(findAnomalyScanRule([])).toBeUndefined();
  });
});

describe('scanSummary', () => {
  const cases = [
    { name: 'nothing new', r: { raised: 0, alreadyKnown: 4, alertsSent: 0, alertsFailed: 0 }, want: 'No new anomalies found' },
    { name: 'one, one alert', r: { raised: 1, alreadyKnown: 0, alertsSent: 1, alertsFailed: 0 }, want: '1 new anomaly found, 1 alert sent' },
    { name: 'several', r: { raised: 3, alreadyKnown: 0, alertsSent: 2, alertsFailed: 0 }, want: '3 new anomalies found, 2 alerts sent' },
    { name: 'failed sends', r: { raised: 2, alreadyKnown: 0, alertsSent: 1, alertsFailed: 1 }, want: '2 new anomalies found, 1 alert sent, 1 could not be sent' },
  ];
  it.each(cases)('$name', ({ r, want }) => {
    expect(scanSummary(r)).toBe(want);
  });
});
