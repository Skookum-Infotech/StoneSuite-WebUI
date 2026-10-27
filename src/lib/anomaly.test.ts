import { describe, it, expect } from 'vitest';
import {
  ANOMALY_FILTERS,
  ANOMALY_PAGE_SIZE,
  anomalyRuleLabel,
  buildAnomalyParams,
  findAnomalyScanRule,
  reviewActions,
} from './anomaly';
import type { AnomalyStatus } from '@/types/anomaly';

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
