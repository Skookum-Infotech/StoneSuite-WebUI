import { Switch } from '@/components/ui/switch';
import { useAutomationKillSwitch } from '@/hooks/useAutomationKillSwitch';
import { NO_CONFIGURE_PERMISSION } from '@/lib/automationCopy';

interface Props {
  paused: boolean;
  canConfigure: boolean;
  /** Settings still loading (or failed): the real state is unknown, so it cannot be flipped. */
  unavailable: boolean;
}

/** The workspace-wide "Pause all automated emails" switch in the page header. */
export function PauseSwitch({ paused, canConfigure, unavailable }: Props) {
  const killSwitch = useAutomationKillSwitch();
  const disabled = !canConfigure || unavailable || killSwitch.isPending;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900">
      <label htmlFor="automation-pause" className="text-xs font-medium text-stone-700 dark:text-stone-200">
        Pause all automated emails
      </label>
      <span title={canConfigure ? undefined : NO_CONFIGURE_PERMISSION}>
        <Switch
          id="automation-pause"
          checked={paused}
          disabled={disabled}
          onCheckedChange={(next) => killSwitch.mutate(next)}
        />
      </span>
    </div>
  );
}
