import { cn } from '@/lib/utils';
import { BAR_TONE_CLASS } from '@/lib/unitConsumption';
import type { BarSegment } from '@/lib/unitConsumption';

const SIZE_CLASS = { sm: 'h-1.5', md: 'h-3' } as const;

// A stacked bar: one coloured segment per part of the whole. It is a picture of
// numbers shown next to it, so it is exposed to assistive tech as a single image
// with the full description rather than as empty divs.
export function UnitConsumptionBar({
  segments,
  label,
  size = 'sm',
}: {
  segments: BarSegment[];
  label: string;
  size?: keyof typeof SIZE_CLASS;
}) {
  return (
    <div role="img" aria-label={label} className={cn('flex w-full overflow-hidden rounded-full bg-stone-100', SIZE_CLASS[size])}>
      {segments.map((s) => (
        <div key={s.tone} className={cn('h-full transition-all', BAR_TONE_CLASS[s.tone])} style={{ width: `${s.pct}%` }} />
      ))}
    </div>
  );
}
