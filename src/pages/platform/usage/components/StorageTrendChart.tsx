import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TAB_LIST_CLASS, tabClass } from '@/components/ui/tabStyles';
import { formatBytes } from '@/lib/usageFormat';
import type { UsagePoint } from '@/types/platformUsage';
import {
  AXIS_COLOR,
  AXIS_FONT_SIZE,
  DB_COLOR,
  GRID_COLOR,
  LINE_FILL_OPACITY,
  R2_COLOR,
  USAGE_CHART_HEIGHT,
  shortDate,
} from './usageChartTheme';

type StorageKind = 'r2Bytes' | 'dbBytes';

const KINDS: { key: StorageKind; label: string; color: string }[] = [
  { key: 'r2Bytes', label: 'R2 files', color: R2_COLOR },
  { key: 'dbBytes', label: 'Database', color: DB_COLOR },
];

const bytesTooltip = (v: unknown): string => formatBytes(typeof v === 'number' ? v : Number(v));

/** R2 or database size per day; one at a time, since their scales differ by 100×. */
export function StorageTrendChart({ series }: { series: UsagePoint[] }) {
  const [kind, setKind] = useState<StorageKind>('r2Bytes');
  const active = KINDS.find((k) => k.key === kind) ?? KINDS[0];
  const last = series[series.length - 1];
  const summary = last
    ? `${active.label} size from ${shortDate(series[0].date)} to ${shortDate(last.date)}, now ${formatBytes(last[kind])}`
    : 'No storage measured';

  return (
    <section aria-labelledby="storage-chart-heading" className="min-w-0 rounded-2xl border border-stone-200 bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="storage-chart-heading" className="text-sm font-bold text-stone-950">
          Storage over time
        </h2>
        <div role="radiogroup" aria-label="Storage type" className={TAB_LIST_CLASS}>
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={kind === k.key}
              aria-label={`Show ${k.label} storage`}
              onClick={() => setKind(k.key)}
              className={tabClass(kind === k.key)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <div role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={USAGE_CHART_HEIGHT}>
          <AreaChart data={series} margin={{ left: 0, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: AXIS_FONT_SIZE, fill: AXIS_COLOR }} minTickGap={24} />
            <YAxis tickFormatter={formatBytes} tick={{ fontSize: AXIS_FONT_SIZE, fill: AXIS_COLOR }} width={56} />
            <Tooltip formatter={bytesTooltip} labelFormatter={(l) => shortDate(String(l))} />
            <Area type="monotone" dataKey={kind} name={active.label} stroke={active.color} strokeWidth={2} fill={active.color} fillOpacity={LINE_FILL_OPACITY} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
