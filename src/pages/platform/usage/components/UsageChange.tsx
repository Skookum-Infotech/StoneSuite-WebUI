import { DeltaIndicator } from '@/pages/dashboard/components/DeltaIndicator';
import { NOTABLE_CHANGE_PCT, formatChange, percentChange } from '@/lib/usageWatchlist';

/** Period-over-period change as a small pill. Growth isn't good or bad on its
 *  own here, so only a large jump gets the warning tone. */
export function UsageChange({ now, prev }: { now: number | null; prev: number | null }) {
  const change = percentChange(now, prev);
  if (change === null) return <span className="text-2xs text-stone-400">—</span>;
  return (
    <DeltaIndicator
      variant="trend"
      text={formatChange(change).replace(/^[+-]/, '')}
      tone={change >= NOTABLE_CHANGE_PCT ? 'warn' : 'neutral'}
      direction={change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}
    />
  );
}
