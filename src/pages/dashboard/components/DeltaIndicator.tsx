import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DeltaTone = 'up' | 'warn' | 'neutral';
export type DeltaDirection = 'up' | 'down' | 'flat';

// 'up' reuses the brand-lime "positive" ink, 'warn' the single amber warning
// accent, 'neutral' the muted grey — matching the tones the KPI strip has
// always used, so a switch away from the ▲/▼ glyphs keeps the same palette.
const NOTE_TONE: Record<DeltaTone, string> = {
  up: 'text-brand-dark-hover',
  warn: 'text-warning',
  neutral: 'text-stone-500',
};

const CHIP_TONE: Record<DeltaTone, string> = {
  up: 'bg-brand/15 text-brand-dark-hover',
  warn: 'bg-warning/10 text-warning',
  neutral: 'bg-stone-100 text-stone-500',
};

/**
 * The sub-line under a KPI value. `note` is informational text (a sub-metric
 * label like "4 in fabrication") tinted by tone. `trend` is a period-over-
 * period movement, shown as a pill with a direction arrow.
 */
export function DeltaIndicator({
  variant,
  text,
  tone,
  direction = 'flat',
}: {
  variant: 'note' | 'trend';
  text: string;
  tone: DeltaTone;
  direction?: DeltaDirection;
}) {
  if (variant === 'note') {
    return (
      <span className={cn('text-[11px] font-semibold whitespace-nowrap', NOTE_TONE[tone])}>{text}</span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap',
        CHIP_TONE[tone],
      )}
    >
      {direction === 'up' && <ArrowUp className="size-2.5" aria-hidden="true" />}
      {direction === 'down' && <ArrowDown className="size-2.5" aria-hidden="true" />}
      {text}
    </span>
  );
}
