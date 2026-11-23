import { describe, it, expect } from 'vitest';
import { formatMoney } from './formatMoney';
import { describeCrmWindow, formatDays, funnelReportTable, sourceReportTable, staleReportTable } from './crmReportTables';
import type { CrmFunnel, CrmReportParams, CrmSourceReport, CrmStaleReport } from '@/types/reports';

const PARAMS: CrmReportParams = { from: '2026-01-01', to: '2026-01-31' };

describe('formatDays', () => {
  it.each([
    [null, '—'],
    [0, '0.0'],
    [6.54, '6.5'],
    [12, '12.0'],
  ])('%s -> %s', (input, want) => {
    expect(formatDays(input)).toBe(want);
  });
});

describe('describeCrmWindow', () => {
  it('says the window is about lead creation date', () => {
    expect(describeCrmWindow(PARAMS)).toMatch(/^Leads created .* to /);
  });
});

describe('funnelReportTable', () => {
  const funnel: CrmFunnel = {
    unqualified: 1,
    stages: [
      { key: 'leads', label: 'Leads created', count: 10, percentOfLeads: 100, percentOfPrevious: 100, avgDaysFromLead: null },
      { key: 'prospects', label: 'Became prospects', count: 4, percentOfLeads: 40, percentOfPrevious: 40, avgDaysFromLead: 3.25 },
    ],
  };

  it('has a cell for every header and formats percentages and days', () => {
    const t = funnelReportTable(funnel, PARAMS);
    for (const row of t.rows) expect(row).toHaveLength(t.headers.length);
    expect(t.rows[1]).toEqual(['Became prospects', '4', '40.0%', '40.0%', '3.3']);
    expect(t.rows[0][4]).toBe('—');
  });
});

describe('sourceReportTable', () => {
  const report: CrmSourceReport = {
    totals: { leads: 6, customers: 1, conversionPercent: 16.666, revenue: 500 },
    rows: [
      { source: 'Referral', leads: 2, qualified: 2, prospects: 1, customers: 1, conversionPercent: 50, revenue: 500, revenuePerLead: 250 },
    ],
  };

  it('lines up rows and totals with the headers', () => {
    const t = sourceReportTable(report, PARAMS);
    expect(t.rows[0]).toEqual(['Referral', '2', '2', '1', '1', '50.0%', formatMoney(500), formatMoney(250)]);
    expect(t.totalsRow).toHaveLength(t.headers.length);
    expect(t.totalsRow?.[5]).toBe('16.7%');
  });
});

describe('staleReportTable', () => {
  it('labels stages, dashes empty status/owner and states the threshold', () => {
    const report: CrmStaleReport = {
      days: 30,
      rows: [{ id: 'a', stage: 'prospect', name: 'Acme', status: '', owner: '', lastTouch: '2026-01-05T00:00:00Z', daysIdle: 45 }],
    };
    const t = staleReportTable(report);
    expect(t.subtitle).toContain('30+ days');
    expect(t.rows[0]).toEqual(['Acme', 'Prospect', '—', '—', t.rows[0][4], '45']);
    expect(t.rows[0]).toHaveLength(t.headers.length);
  });
});
