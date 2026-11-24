import { cn } from '@/lib/utils';
import {
  PROGRESS_SEGMENTS, filledSegments, progressTone, type ProgressTone,
} from '@/lib/receivingProgress';

const SEGMENT_INDEXES = Array.from({ length: PROGRESS_SEGMENTS }, (_, i) => i);

/** `progress` fills toward a goal, so a full bar is good news (green). `quota`
 *  fills toward a ceiling, so a full bar means the limit is reached (red). */
export type ProgressVariant = 'progress' | 'quota';

const FILL_CLASS: Record<ProgressVariant, Record<ProgressTone, string>> = {
  progress: { empty: 'bg-stone-200', partial: 'bg-orange-500', complete: 'bg-emerald-500' },
  quota: { empty: 'bg-stone-200', partial: 'bg-orange-500', complete: 'bg-red-500' },
};

/** A row of equal segments, lit left to right: orange while partway, then green
 *  once complete (or red at 100% for a `quota`, where full is bad). `valueLabel`
 *  replaces the "NN%" shown beside it. `block` stretches the segments across the
 *  container instead of a fixed width. */
export function SegmentedProgressBar({
  percent, ariaLabel, valueLabel, block = false, variant = 'progress',
}: {
  percent: number;
  ariaLabel: string;
  valueLabel?: string;
  block?: boolean;
  variant?: ProgressVariant;
}) {
  const lit = filledSegments(percent);
  const fill = FILL_CLASS[variant][progressTone(percent)];
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
      <span className="shrink-0 text-xs font-medium tabular-nums text-ink-muted">{valueLabel ?? `${percent}%`}</span>
    </div>
  );
}
