import { cn } from '@/lib/utils';
import {
  PROGRESS_SEGMENTS, filledSegments, progressTone, type ProgressTone,
} from '@/lib/receivingProgress';

const SEGMENT_INDEXES = Array.from({ length: PROGRESS_SEGMENTS }, (_, i) => i);

const FILL_CLASS: Record<ProgressTone, string> = {
  empty: 'bg-stone-200',
  partial: 'bg-orange-500',
  complete: 'bg-emerald-500',
};

/** A row of equal segments, lit left to right: orange while partway, green
 *  once complete. `valueLabel` replaces the "NN%" shown beside it. `block`
 *  stretches the segments across the container instead of a fixed width. */
export function SegmentedProgressBar({
  percent, ariaLabel, valueLabel, block = false,
}: {
  percent: number;
  ariaLabel: string;
  valueLabel?: string;
  block?: boolean;
}) {
  const lit = filledSegments(percent);
  const fill = FILL_CLASS[progressTone(percent)];
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueLabel ?? `${percent}%`}
      className={cn('flex items-center gap-2.5', block && 'w-full')}
    >
      <div className={cn('flex gap-0.5', block && 'flex-1')} aria-hidden="true">
        {SEGMENT_INDEXES.map((i) => (
          <span
            key={i}
            className={cn('h-3.5 rounded-[2px]', block ? 'flex-1' : 'w-1.5', i < lit ? fill : 'bg-stone-200')}
          />
        ))}
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-stone-500">{valueLabel ?? `${percent}%`}</span>
    </div>
  );
}
