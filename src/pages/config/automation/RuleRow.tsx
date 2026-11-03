import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { Badge } from '@/components/tenant/ui';
import { Switch } from '@/components/ui/switch';
import { AUTOMATION_RULES_QUERY_KEY, AUTOMATION_SETTINGS_QUERY_KEY } from '@/hooks/useAutomationKillSwitch';
import {
  ANOMALIES_PATH,
  DELIVERIES_PATH,
  NO_CONFIGURE_PERMISSION,
  RULE_KEY,
  audienceLabel,
  cadenceText,
  confirmsDisable,
  enabledSinceText,
  lastCheckedText,
  ruleDescription,
} from '@/lib/automationCopy';
import { automationRuleService } from '@/services/automationRuleService';
import type { AutomationRule } from '@/types/automationRule';
import { ConfirmToggleDialog } from './ConfirmToggleDialog';

interface Props {
  rule: AutomationRule;
  canConfigure: boolean;
  /** An enabled rule that will not send because automation is off or paused. */
  notSending: boolean;
  onPreview: (rule: AutomationRule) => void;
}

const LINK_CLASS = 'text-xs font-medium text-brand-dark underline-offset-2 hover:underline';

function StatusLabel({ rule, notSending }: Pick<Props, 'rule' | 'notSending'>) {
  if (!rule.enabled) return <span className="text-xs text-stone-500">Off</span>;
  const since = rule.enabledAt ? enabledSinceText(rule.enabledAt) : '';
  return (
    <span className="text-xs text-stone-500">
      {notSending ? 'On (not sending)' : 'On'}
      {since && <span className="block text-2xs">{since}</span>}
    </span>
  );
}

/** One automation rule: a card on phones, a grid row from md up. */
export function RuleRow({ rule, canConfigure, notSending, onPreview }: Props) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => automationRuleService.setEnabled(rule.ruleKey, enabled),
    onSuccess: (updated) => {
      toast.success(`${updated.name} turned ${updated.enabled ? 'on' : 'off'}`);
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: [AUTOMATION_RULES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [AUTOMATION_SETTINGS_QUERY_KEY] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, `Could not change ${rule.name}.`));
      setConfirming(false);
    },
  });

  function handleSwitch(next: boolean) {
    // Turning a rule on always asks; turning one off asks only if it emails customers.
    if (next || confirmsDisable(rule)) setConfirming(true);
    else toggle.mutate(next);
  }

  const isAnomalyScan = rule.ruleKey === RULE_KEY.anomalyScan;
  return (
    <li className="flex flex-col gap-3 border-b border-stone-100 p-4 last:border-b-0 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.4fr)] md:items-center md:gap-4 dark:border-stone-800">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-white">{rule.name}</h2>
          <Badge size="sm">{audienceLabel(rule.audience)}</Badge>
        </div>
        <p className="mt-1 text-xs text-stone-500">{ruleDescription(rule.ruleKey)}</p>
      </div>
      <div className="min-w-0 text-xs text-stone-600 dark:text-stone-300">
        <p>{cadenceText(rule.ruleKey, rule.cadence)}</p>
        {/* The anomaly scan never stamps last_planned_at, so "Not run yet" would be wrong for it. */}
        {!isAnomalyScan && <p className="mt-0.5 text-stone-500">{lastCheckedText(rule.lastPlannedAt)}</p>}
      </div>
      <div className="flex items-center gap-3">
        {isAnomalyScan ? (
          <Link to={ANOMALIES_PATH} className={LINK_CLASS}>
            Manage on Anomalies page
          </Link>
        ) : (
          <>
            <span title={canConfigure ? undefined : NO_CONFIGURE_PERMISSION}>
              <Switch
                checked={rule.enabled}
                disabled={!canConfigure || toggle.isPending}
                onCheckedChange={handleSwitch}
                aria-label={rule.name}
              />
            </span>
            <StatusLabel rule={rule} notSending={notSending} />
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {rule.previewSupported && (
          <button
            type="button"
            onClick={() => onPreview(rule)}
            aria-label={`Preview ${rule.name}`}
            className={LINK_CLASS}
          >
            Preview
          </button>
        )}
        <Link
          to={`${DELIVERIES_PATH}?ruleKey=${encodeURIComponent(rule.ruleKey)}`}
          aria-label={`View deliveries for ${rule.name}`}
          className={LINK_CLASS}
        >
          View deliveries
        </Link>
      </div>
      {confirming && (
        <ConfirmToggleDialog
          rule={rule}
          pending={toggle.isPending}
          onConfirm={() => toggle.mutate(!rule.enabled)}
          onCancel={() => setConfirming(false)}
          onPreview={() => {
            setConfirming(false);
            onPreview(rule);
          }}
        />
      )}
    </li>
  );
}
