import { cn } from '@/lib/utils';

const TONE_CLASS = {
  lime: '[&::-moz-progress-bar]:bg-brand-dark [&::-webkit-progress-value]:bg-brand-dark',
  teal: '[&::-moz-progress-bar]:bg-teal-600 [&::-webkit-progress-value]:bg-teal-600',
} as const;

/** Thin horizontal bar (native <progress>, so no inline width styles). */
export function UsageBar({
  value,
  max,
  label,
  tone = 'lime',
}: {
  value: number;
  max: number;
  label: string;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <progress
      aria-label={label}
      value={value}
      max={Math.max(max, 1)}
      className={cn(
        'block h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-stone-100 dark:[&::-webkit-progress-bar]:bg-stone-800',
        TONE_CLASS[tone],
      )}
    />
  );
}
