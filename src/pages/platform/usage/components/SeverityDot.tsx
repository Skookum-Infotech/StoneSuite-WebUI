import { cn } from '@/lib/utils';
import { SEVERITY_DOT_CLASS } from '@/lib/usageWatchlist';
import type { AlertSeverity } from '@/types/platformUsage';

/** Small status dot; an empty ring when there is nothing open. `label` is read
 *  by screen readers and shown on hover. */
export function SeverityDot({ severity, label }: { severity: AlertSeverity | null; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-block size-2.5 rounded-full',
        severity ? SEVERITY_DOT_CLASS[severity] : 'border-[1.5px] border-stone-300',
      )}
    />
  );
}
