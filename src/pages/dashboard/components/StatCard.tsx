import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatCardData } from '../mockData';

const trendIcon = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;
const trendColor = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-rose-600 dark:text-rose-400',
  flat: 'text-stone-500',
} as const;

export function StatCard({ stat }: { stat: StatCardData }) {
  const TrendIcon = trendIcon[stat.trend];
  const Icon = stat.icon;

  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-4 rounded-2xl border p-5',
        stat.hero
          ? 'border-brand/40 bg-gradient-to-br from-brand/15 via-card to-card ring-1 ring-brand/20'
          : 'border-stone-300/70 bg-card ring-1 ring-foreground/5',
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn('text-2xs font-semibold uppercase tracking-wide', stat.hero ? 'text-brand-dark' : 'text-muted-foreground')}>
          {stat.label}
        </span>
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', stat.iconBg)}>
          <Icon className={cn('size-4.5', stat.iconColor)} aria-hidden="true" />
        </div>
      </div>

      <div>
        <p className={cn('font-brand tabular-nums text-foreground', stat.hero ? 'text-4xl' : 'text-3xl')}>
          {stat.value}
        </p>
        <div className={cn('mt-1.5 flex items-center gap-1 text-xs font-medium', trendColor[stat.trend])}>
          <TrendIcon className="size-3.5" aria-hidden="true" />
          <span>{stat.delta}</span>
        </div>
      </div>
    </div>
  );
}
