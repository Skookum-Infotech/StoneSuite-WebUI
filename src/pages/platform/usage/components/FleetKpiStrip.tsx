import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatBytes, formatComputeHours, formatTokenCount } from '@/lib/usageFormat';
import { KpiSparkline } from '@/pages/dashboard/components/KpiSparkline';
import type { FleetTotals } from '@/types/platformUsage';
import { UsageChange } from './UsageChange';
import { EstimateTag } from './EstimateTag';

const SPARK_COLOR = '#719c3b';

function Tile({ label, value, children, alert }: { label: ReactNode; value: string; children?: ReactNode; alert?: boolean }) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-3.5',
        alert ? 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30' : 'border-stone-200',
      )}
    >
      <span className="text-2xs font-semibold uppercase tracking-wide text-stone-500">{label}</span>
      <span className={cn('text-xl font-bold tabular-nums tracking-tight', alert ? 'text-red-600' : 'text-stone-950')}>
        {value}
      </span>
      <div className="flex min-h-[22px] items-center justify-between gap-2 text-xs text-stone-500">{children}</div>
    </div>
  );
}

/** Fleet-wide totals for the period, with the change from the previous period. */
export function FleetKpiStrip({
  fleet,
  openAlerts,
  criticalAlerts,
}: {
  fleet: FleetTotals;
  openAlerts: number;
  criticalAlerts: number;
}) {
  const pending = fleet.totalTenants - fleet.activeTenants;
  return (
    <section aria-label="Fleet totals" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile label="Active tenants" value={String(fleet.activeTenants)}>
        <span>
          {fleet.totalTenants} total{pending > 0 ? ` · ${pending} not active` : ''}
        </span>
      </Tile>
      <Tile label={<>Compute <EstimateTag /></>} value={formatComputeHours(fleet.computeHours)}>
        <UsageChange now={fleet.computeHours} prev={fleet.computeHoursPrev} />
        {fleet.computeTrend.length > 1 && <KpiSparkline points={fleet.computeTrend} color={SPARK_COLOR} />}
      </Tile>
      <Tile label="Database storage" value={formatBytes(fleet.dbBytes)}>
        <UsageChange now={fleet.dbBytes} prev={fleet.dbBytesPrev} />
        <span>Neon</span>
      </Tile>
      <Tile label="R2 storage" value={formatBytes(fleet.r2Bytes)}>
        <UsageChange now={fleet.r2Bytes} prev={fleet.r2BytesPrev} />
        <span>Cloudflare</span>
      </Tile>
      <Tile label="AI tokens" value={formatTokenCount(fleet.aiTokens)}>
        <UsageChange now={fleet.aiTokens} prev={fleet.aiTokensPrev} />
      </Tile>
      <Tile label="Open alerts" value={String(openAlerts)} alert={criticalAlerts > 0}>
        <span>{criticalAlerts} critical</span>
      </Tile>
    </section>
  );
}
