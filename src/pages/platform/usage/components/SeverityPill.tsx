import { cn } from '@/lib/utils';
import { SEVERITY_LABEL, SEVERITY_PILL_CLASS } from '@/lib/usageWatchlist';
import type { AlertSeverity } from '@/types/platformUsage';

/** Severity chip. The word is always shown, so the state never relies on colour alone. */
export function SeverityPill({ severity, label }: { severity: AlertSeverity; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-max items-center rounded-full border px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
        SEVERITY_PILL_CLASS[severity],
      )}
    >
      {label ?? SEVERITY_LABEL[severity]}
    </span>
  );
}
