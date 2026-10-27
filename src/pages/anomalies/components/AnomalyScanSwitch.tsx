import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { apiErrorMessage } from '@/api/tenantClient';
import { automationRuleService } from '@/services/automationRuleService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { ANOMALY_SCAN_RULE_KEY, findAnomalyScanRule } from '@/lib/anomaly';

const RULES_QUERY_KEY = 'automation-rules';

/** Workspace-level on/off for the anomaly scan. Shown only to people who may
 *  read automation rules; only those who may configure them can flip it. */
export function AnomalyScanSwitch() {
  const queryClient = useQueryClient();
  const { hasPermission } = useUserPermissions();
  const canRead = hasPermission('automation', 'read');
  const canConfigure = hasPermission('automation', 'configure');

  const rulesQ = useQuery({
    queryKey: [RULES_QUERY_KEY],
    queryFn: () => automationRuleService.list(),
    enabled: canRead,
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => automationRuleService.setEnabled(ANOMALY_SCAN_RULE_KEY, enabled),
    onSuccess: (rule) => {
      toast.success(rule.enabled ? 'Anomaly scanning turned on' : 'Anomaly scanning turned off');
      queryClient.invalidateQueries({ queryKey: [RULES_QUERY_KEY] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not change anomaly scanning.')),
  });

  const rule = findAnomalyScanRule(rulesQ.data ?? []);
  if (!canRead || !rule) return null;

  return (
    <div className="ml-auto flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2">
      <div className="text-right">
        <p className="text-xs font-medium text-stone-700">Anomaly scanning</p>
        <p className="text-2xs text-stone-500">
          {rule.enabled ? 'On — checked every 15 minutes' : 'Off — nothing is checked or sent'}
        </p>
      </div>
      <Switch
        checked={rule.enabled}
        disabled={!canConfigure || toggle.isPending}
        onCheckedChange={(next) => toggle.mutate(next)}
        aria-label="Anomaly scanning"
      />
    </div>
  );
}
