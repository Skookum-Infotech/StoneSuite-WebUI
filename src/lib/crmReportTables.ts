import { formatMoney } from '@/lib/formatMoney';
import type { ReportTable } from '@/lib/reportExport';
import { formatPercent, formatReportDate } from '@/lib/reportFormat';
import type { CrmFunnel, CrmReportParams, CrmSourceReport, CrmStaleReport } from '@/types/reports';

const NO_VALUE = '—';
const DAYS_DECIMALS = 1;
export const STAGE_LABELS: Record<'lead' | 'prospect', string> = { lead: 'Lead', prospect: 'Prospect' };

/** "Leads created Jan 1, 2026 to Nov 6, 2026". */
export function describeCrmWindow(params: CrmReportParams): string {
  return `Leads created ${formatReportDate(params.from)} to ${formatReportDate(params.to)}`;
}

/** Average days as "6.5", or a dash where the funnel has no data for it. */
export function formatDays(days: number | null): string {
  return days === null ? NO_VALUE : days.toFixed(DAYS_DECIMALS);
}

export function funnelReportTable(funnel: CrmFunnel, params: CrmReportParams): ReportTable {
  return {
    title: 'Conversion Funnel',
    subtitle: describeCrmWindow(params),
    headers: ['Stage', 'Leads', '% of all leads', '% of previous stage', 'Avg days from lead'],
    rows: funnel.stages.map((s) => [
      s.label,
      String(s.count),
      formatPercent(s.percentOfLeads),
      formatPercent(s.percentOfPrevious),
      formatDays(s.avgDaysFromLead),
    ]),
  };
}

export function sourceReportTable(report: CrmSourceReport, params: CrmReportParams): ReportTable {
  const t = report.totals;
  return {
    title: 'Lead Source Performance',
    subtitle: `${describeCrmWindow(params)} · revenue is billed net sales to the customers those leads became`,
    headers: ['Source', 'Leads', 'Qualified', 'Prospects', 'Customers', 'Conversion %', 'Revenue', 'Revenue per lead'],
    rows: report.rows.map((r) => [
      r.source,
      String(r.leads),
      String(r.qualified),
      String(r.prospects),
      String(r.customers),
      formatPercent(r.conversionPercent),
      formatMoney(r.revenue),
      formatMoney(r.revenuePerLead),
    ]),
    totalsRow: ['Total', String(t.leads), '', '', String(t.customers), formatPercent(t.conversionPercent), formatMoney(t.revenue), ''],
  };
}

export function staleReportTable(report: CrmStaleReport): ReportTable {
  return {
    title: 'Stale Leads and Prospects',
    subtitle: `Open leads and prospects with no logged activity or status change for ${report.days}+ days`,
    headers: ['Name', 'Stage', 'Status', 'Owner', 'Last activity', 'Days idle'],
    rows: report.rows.map((r) => [
      r.name,
      STAGE_LABELS[r.stage],
      r.status || NO_VALUE,
      r.owner || NO_VALUE,
      formatReportDate(r.lastTouch),
      String(r.daysIdle),
    ]),
  };
}
