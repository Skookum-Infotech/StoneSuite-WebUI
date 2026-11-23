import { AlertTriangle, PauseCircle } from 'lucide-react';
import { useAutomationKillSwitch } from '@/hooks/useAutomationKillSwitch';
import { BANNER_TEXT, bannerKind } from '@/lib/automationCopy';
import type { AutomationSettings } from '@/types/automationSettings';

interface Props {
  settings: AutomationSettings | undefined;
  canConfigure: boolean;
}

/** Explains why enabled rules may not be sending: platform off, workspace paused, or unknown. */
export function AutomationStatusBanner({ settings, canConfigure }: Props) {
  const killSwitch = useAutomationKillSwitch();
  const kind = bannerKind(settings);
  if (!kind) return null;

  const paused = kind === 'paused';
  const Icon = paused ? PauseCircle : AlertTriangle;
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{BANNER_TEXT[kind]}</p>
      {paused && canConfigure && (
        <button
          type="button"
          onClick={() => killSwitch.mutate(false)}
          disabled={killSwitch.isPending}
          aria-label="Resume automated emails"
          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-stone-900 dark:text-amber-200"
        >
          Resume
        </button>
      )}
    </div>
  );
}
