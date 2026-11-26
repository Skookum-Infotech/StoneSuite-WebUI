import { cn } from '@/lib/utils';
import { KpiSparkline } from '@/pages/dashboard/components/KpiSparkline';
import type { AlertSeverity, UsageMetric } from '@/types/platformUsage';
import { EstimateTag } from './EstimateTag';
import { UsageChange } from './UsageChange';

const FLAG_CLASS: Record<AlertSeverity, string> = {
  critical: 'border-red-200 shadow-[inset_3px_0_0_#dc2626] dark:border-red-900',
  warning: 'border-amber-200 shadow-[inset_3px_0_0_#d97706] dark:border-amber-900',
  info: 'border-blue-200 shadow-[inset_3px_0_0_#2563eb] dark:border-blue-900',
};
const SPARK_COLOR = '#719c3b';
const SPARK_ALERT_COLOR = '#dc2626';

/** One headline figure on the tenant detail page. */
export function UsageMetricCard({ metric }: { metric: UsageMetric }) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1.5 rounded-2xl border bg-card p-3.5',
        metric.severity ? FLAG_CLASS[metric.severity] : 'border-stone-200',
      )}
    >
      <span className="text-2xs font-semibold uppercase tracking-wide text-stone-500">
        {metric.label}
        {metric.estimated && <EstimateTag />}
      </span>
      <div className="flex items-end justify-between gap-2">
        <span className="text-xl font-bold tabular-nums tracking-tight text-stone-950">{metric.value}</span>
        {metric.spark && metric.spark.length > 1 && (
          <KpiSparkline points={metric.spark} color={metric.severity === 'critical' ? SPARK_ALERT_COLOR : SPARK_COLOR} />
        )}
      </div>
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
        {metric.change && <UsageChange now={metric.change.now} prev={metric.change.prev} />}
        {metric.sub}
      </span>
    </div>
  );
}
