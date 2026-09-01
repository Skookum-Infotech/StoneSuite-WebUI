import { cn } from '@/lib/utils';
import { KpiSparkline } from './KpiSparkline';
import type { KpiMetric } from '../mockData';

const DELTA_TONE_CLASS: Record<KpiMetric['deltaTone'], string> = {
  up: 'text-brand-dark-hover',
  warn: 'text-warning',
  neutral: 'text-stone-500',
};

export function KpiStrip({ metrics }: { metrics: KpiMetric[] }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-stone-300 overflow-hidden rounded-2xl border border-stone-300 bg-card md:grid-cols-4 md:divide-x md:divide-y-0">
      {metrics.map((m) => (
        <div key={m.id} className="p-[18px]">
          <div className="text-[10.5px] font-semibold uppercase tracking-[.09em] text-stone-500">{m.label}</div>
          <div className="mt-1.5 text-[26px] font-bold leading-none tracking-[-0.02em] text-stone-950 tabular-nums">
            {m.value}
          </div>
          <div className="mt-2.5 flex items-end justify-between gap-2.5">
            <span className={cn('text-[11px] font-semibold whitespace-nowrap', DELTA_TONE_CLASS[m.deltaTone])}>
              {m.delta}
            </span>
            <KpiSparkline points={m.sparkline} color={m.sparklineColor} />
          </div>
        </div>
      ))}
    </div>
  );
}
