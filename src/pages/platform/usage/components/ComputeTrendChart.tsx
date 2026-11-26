import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatComputeHours } from '@/lib/usageFormat';
import type { UsagePoint } from '@/types/platformUsage';
import { EstimateTag } from './EstimateTag';
import {
  AREA_FILL_OPACITY,
  AXIS_COLOR,
  AXIS_FONT_SIZE,
  GRID_COLOR,
  JOB_COLOR,
  REQUEST_COLOR,
  USAGE_CHART_HEIGHT,
  shortDate,
} from './usageChartTheme';

const hoursTick = (v: number): string => `${v.toFixed(v < 1 ? 2 : 1)}h`;
const hoursTooltip = (v: unknown): string => formatComputeHours(typeof v === 'number' ? v : Number(v));

/** Daily compute hours, stacked into request time and background-job time. */
export function ComputeTrendChart({ series }: { series: UsagePoint[] }) {
  const total = series.reduce((acc, p) => acc + p.computeRequestHours + p.computeJobHours, 0);
  const summary =
    series.length > 0
      ? `Daily compute from ${shortDate(series[0].date)} to ${shortDate(series[series.length - 1].date)}, ${formatComputeHours(total)} in total`
      : 'No compute recorded';
  return (
    <section aria-labelledby="compute-chart-heading" className="min-w-0 rounded-2xl border border-stone-200 bg-card p-4 sm:p-5">
      <h2 id="compute-chart-heading" className="mb-3 text-sm font-bold text-stone-950">
        Compute over time <EstimateTag />
      </h2>
      <div role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={USAGE_CHART_HEIGHT}>
          <AreaChart data={series} margin={{ left: 0, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: AXIS_FONT_SIZE, fill: AXIS_COLOR }} minTickGap={24} />
            <YAxis tickFormatter={hoursTick} tick={{ fontSize: AXIS_FONT_SIZE, fill: AXIS_COLOR }} width={44} />
            <Tooltip formatter={hoursTooltip} labelFormatter={(l) => shortDate(String(l))} />
            <Legend wrapperStyle={{ fontSize: AXIS_FONT_SIZE }} />
            <Area type="monotone" dataKey="computeRequestHours" name="Requests" stackId="c" stroke={REQUEST_COLOR} fill={REQUEST_COLOR} fillOpacity={AREA_FILL_OPACITY} />
            <Area type="monotone" dataKey="computeJobHours" name="Background jobs" stackId="c" stroke={JOB_COLOR} fill={JOB_COLOR} fillOpacity={AREA_FILL_OPACITY} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
