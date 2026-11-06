import { cn } from '@/lib/utils';
import { ageTone, waitingLabel, type AgeTone } from '@/lib/approvalInbox';

const TONE_CLASSES: Record<AgeTone, string> = {
  neutral: 'border-stone-200 bg-stone-50 text-stone-600',
  amber: 'border-amber-300 bg-amber-50 text-amber-800',
  red: 'border-red-300 bg-red-50 text-red-800',
};

/** "Waiting N days" pill. Colour is reinforcement only -- the label carries the meaning. */
export function AgeBadge({ days }: { days: number }) {
  const tone = ageTone(days);
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-2xs font-semibold',
        TONE_CLASSES[tone],
      )}
    >
      {waitingLabel(days)}
    </span>
  );
}
