import { cn } from '@/lib/utils';
import { KpiSparkline } from './KpiSparkline';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { KpiMetric } from '@/types/dashboardData';

// Presentation (label, sparkline color, value format) stays client-side; the
// backend returns only raw numbers (see dashboardDataService.getKpiStrip). A
// metric missing from the response means the caller holds no read grant on
// its underlying resource (controllers/dashboard_kpi.go omits ungranted
// metrics rather than reporting them as zero) -- so it's simply absent here.
const METRIC_META: Record<KpiMetric['id'], { label: string; sparklineColor: string; format: 'currency' | 'count' }> = {
  revenue: { label: 'Revenue', sparklineColor: '#719c3b', format: 'currency' },
  'open-leads': { label: 'Open Leads', sparklineColor: '#a855f7', format: 'count' },
  'sales-orders-fabrication': { label: 'Sales Orders', sparklineColor: '#059669', format: 'count' },
  'needs-approval': { label: 'Needs Approval', sparklineColor: '#d97706', format: 'count' },
};

type DeltaTone = 'up' | 'warn' | 'neutral';

const DELTA_TONE_CLASS: Record<DeltaTone, string> = {
  up: 'text-brand-dark-hover',
  warn: 'text-warning',
  neutral: 'text-stone-500',
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatValue(m: KpiMetric): string {
  return METRIC_META[m.id].format === 'currency' ? currencyFormatter.format(m.value) : String(Math.round(m.value));
}

// A metric carries a %/count trend (revenue, open leads) XOR a sub-metric
// subLabel (sales orders, needs approval) -- never both. A negative trend
// reads 'warn', not a distinct "down" color, matching the existing 3-tone
// palette (DELTA_TONE_CLASS has no "down").
function formatDelta(m: KpiMetric): { text: string; tone: DeltaTone } {
  if (m.deltaPct !== undefined) {
    if (m.deltaPct > 0) return { text: `▲ ${m.deltaPct}%`, tone: 'up' };
    if (m.deltaPct < 0) return { text: `▼ ${Math.abs(m.deltaPct)}%`, tone: 'warn' };
    return { text: '0%', tone: 'neutral' };
  }
  if (m.deltaCount !== undefined) {
    if (m.deltaCount > 0) return { text: `▲ ${m.deltaCount} this week`, tone: 'up' };
    if (m.deltaCount < 0) return { text: `▼ ${Math.abs(m.deltaCount)} this week`, tone: 'warn' };
    return { text: 'No change this week', tone: 'neutral' };
  }
  // Needs Approval reads 'warn' only while something is actually pending --
  // a caller who's a configured approver with nothing pending right now
  // (value 0, e.g. subLabel "all caught up") must not read as a concerning
  // backlog just because it's the same metric id.
  const tone: DeltaTone = m.id === 'needs-approval' && m.value > 0 ? 'warn' : 'neutral';
  return { text: m.subLabel ?? '', tone };
}

export function KpiStrip({
  metrics,
  isLoading,
  isError,
}: {
  metrics: KpiMetric[] | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-stone-300 bg-card p-[18px]">
        <Spinner label="Loading KPIs…" />
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <div className="rounded-2xl border border-stone-300 bg-card p-[18px]">
        <ErrorNote>Couldn&apos;t load KPI strip.</ErrorNote>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 p-[18px] text-center text-sm text-stone-400">
        No KPI data available for your role.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 divide-y divide-stone-300 overflow-hidden rounded-2xl border border-stone-300 bg-card md:grid-cols-4 md:divide-x md:divide-y-0">
      {metrics.map((m) => {
        const meta = METRIC_META[m.id];
        const delta = formatDelta(m);
        return (
          <div key={m.id} className="p-[18px]">
            <div className="text-[10.5px] font-semibold uppercase tracking-[.09em] text-stone-500">{meta.label}</div>
            <div className="mt-1.5 text-[26px] font-bold leading-none tracking-[-0.02em] text-stone-950 tabular-nums">
              {formatValue(m)}
            </div>
            <div className="mt-2.5 flex items-end justify-between gap-2.5">
              <span className={cn('text-[11px] font-semibold whitespace-nowrap', DELTA_TONE_CLASS[delta.tone])}>
                {delta.text}
              </span>
              {m.sparkline && <KpiSparkline points={m.sparkline} color={meta.sparklineColor} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
