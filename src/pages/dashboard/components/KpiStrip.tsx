import { useNavigate } from 'react-router-dom';
import { ClipboardList, DollarSign, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';
import { useValueFlash } from '@/hooks/useValueFlash';
import { ErrorNote } from '@/components/tenant/ui';
import { KpiSparkline } from './KpiSparkline';
import { DeltaIndicator, type DeltaDirection, type DeltaTone } from './DeltaIndicator';
import type { KpiMetric } from '@/types/dashboardData';

interface MetricMeta {
  label: string;
  sparklineColor: string;
  format: 'currency' | 'count';
  icon: LucideIcon;
  // The list page this KPI drills into, or null when the metric has no single
  // destination (Needs Approval spans every document module's approver queue).
  href: string | null;
}

// Presentation (label, icon, sparkline color, value format, drill-through
// route) stays client-side; the backend returns only raw numbers (see
// dashboardDataService.getKpiStrip). A metric missing from the response means
// the caller holds no read grant on its underlying resource
// (controllers/dashboard_kpi.go omits ungranted metrics rather than reporting
// them as zero) -- so it's simply absent here.
const METRIC_META: Record<KpiMetric['id'], MetricMeta> = {
  revenue: { label: 'Revenue', sparklineColor: '#719c3b', format: 'currency', icon: DollarSign, href: '/sales/invoice' },
  'open-leads': { label: 'Open Leads', sparklineColor: '#a855f7', format: 'count', icon: Users, href: '/crm/lead' },
  'sales-orders-fabrication': { label: 'Sales Orders', sparklineColor: '#059669', format: 'count', icon: ClipboardList, href: '/sales/sales_order' },
  'needs-approval': { label: 'Needs Approval', sparklineColor: '#d97706', format: 'count', icon: ShieldCheck, href: null },
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatValue(meta: MetricMeta, value: number): string {
  return meta.format === 'currency' ? currencyFormatter.format(value) : String(Math.round(value));
}

interface DeltaDescriptor {
  variant: 'note' | 'trend';
  text: string;
  tone: DeltaTone;
  direction: DeltaDirection;
}

// A metric carries a %/count trend (revenue, open leads) XOR a sub-metric
// subLabel (sales orders, needs approval) -- never both. A negative trend
// reads 'warn', not a distinct "down" color, matching the existing 3-tone
// palette (DeltaIndicator has no "down" tone).
function describeDelta(m: KpiMetric): DeltaDescriptor {
  if (m.deltaPct !== undefined) {
    if (m.deltaPct > 0) return { variant: 'trend', text: `${m.deltaPct}%`, tone: 'up', direction: 'up' };
    if (m.deltaPct < 0) return { variant: 'trend', text: `${Math.abs(m.deltaPct)}%`, tone: 'warn', direction: 'down' };
    return { variant: 'trend', text: '0%', tone: 'neutral', direction: 'flat' };
  }
  if (m.deltaCount !== undefined) {
    if (m.deltaCount > 0) return { variant: 'trend', text: `${m.deltaCount} this week`, tone: 'up', direction: 'up' };
    if (m.deltaCount < 0) return { variant: 'trend', text: `${Math.abs(m.deltaCount)} this week`, tone: 'warn', direction: 'down' };
    return { variant: 'trend', text: 'No change this week', tone: 'neutral', direction: 'flat' };
  }
  // Needs Approval reads 'warn' only while something is actually pending -- a
  // caller who's a configured approver with nothing pending right now (value
  // 0, subLabel "all caught up") must not read as a concerning backlog just
  // because it's the same metric id.
  const tone: DeltaTone = m.id === 'needs-approval' && m.value > 0 ? 'warn' : 'neutral';
  return { variant: 'note', text: m.subLabel ?? '', tone, direction: 'flat' };
}

const SHELL = 'overflow-hidden rounded-2xl border border-stone-300';
// `gap-px` over a stone-300 ground draws the hairline dividers between tiles in
// every layout the strip takes — 1 column on phones, 2×2 from `sm`, a single
// row from `lg` — where divide-x / divide-y only work along one axis.
const STRIP_GRID = 'grid grid-cols-1 gap-px bg-stone-300 sm:grid-cols-2';
// One tile per column from `xl` up, matched to the number of granted metrics —
// so a caller with only 2 of the 4 gets 2 half-width tiles, never 2
// quarter-width tiles + 2 dead cells. Below `xl` it's a roomy 2×2.
const XL_COLS: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
};
const TILE = 'group flex flex-col bg-card p-[18px]';

// An odd trailing tile fills the width of the 2-col `sm` grid rather than
// leaving half a row empty; back to one column once `xl` splits them out.
function trailingTileSpan(count: number, index: number): string | undefined {
  return count % 2 === 1 && index === count - 1 ? 'sm:col-span-2 xl:col-span-1' : undefined;
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
      <div className={cn(SHELL, STRIP_GRID, 'xl:grid-cols-4')} role="status" aria-label="Loading KPIs">
        <span className="sr-only">Loading KPIs…</span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-card p-[18px]" aria-hidden="true">
            <div className="h-2.5 w-16 animate-pulse rounded bg-stone-200" />
            <div className="mt-2 h-6 w-24 animate-pulse rounded bg-stone-200" />
            <div className="mt-3 h-3 w-20 animate-pulse rounded bg-stone-200" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !metrics) {
    return (
      <div className={cn(SHELL, 'bg-card p-[18px]')}>
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
    <div className={cn(SHELL, STRIP_GRID, XL_COLS[metrics.length] ?? 'xl:grid-cols-4')}>
      {metrics.map((m, i) => (
        <KpiTile key={m.id} metric={m} className={trailingTileSpan(metrics.length, i)} />
      ))}
    </div>
  );
}

function KpiTile({ metric, className }: { metric: KpiMetric; className?: string }) {
  const navigate = useNavigate();
  const meta = METRIC_META[metric.id];
  const Icon = meta.icon;
  const shown = useCountUp(metric.value);
  const flash = useValueFlash(metric.value);
  const delta = describeDelta(metric);
  const exact = formatValue(meta, metric.value);

  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-500 transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
          <Icon className="size-3" aria-hidden="true" />
        </span>
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[.09em] text-stone-500">{meta.label}</span>
      </div>
      <div className="mt-1.5">
        <span
          className={cn(
            '-mx-1.5 inline-block rounded px-1.5 py-0.5 text-[26px] font-bold leading-none tracking-[-0.02em] text-stone-950 tabular-nums transition-colors duration-500',
            flash ? 'bg-accent/70' : 'bg-transparent',
          )}
        >
          {formatValue(meta, shown)}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <DeltaIndicator variant={delta.variant} text={delta.text} tone={delta.tone} direction={delta.direction} />
        {metric.sparkline && (
          <span className="hidden shrink-0 sm:block">
            <KpiSparkline points={metric.sparkline} color={meta.sparklineColor} />
          </span>
        )}
      </div>
    </>
  );

  if (!meta.href) {
    return <div className={cn(TILE, className)}>{body}</div>;
  }

  const href = meta.href;
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      aria-label={`${meta.label}: ${exact}. View list`}
      className={cn(
        TILE,
        'text-left transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        className,
      )}
    >
      {body}
    </button>
  );
}
