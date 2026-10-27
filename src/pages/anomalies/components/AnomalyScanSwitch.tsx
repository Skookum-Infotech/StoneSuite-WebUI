import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { apiErrorMessage } from '@/api/tenantClient';
import { anomalyService } from '@/services/anomalyService';
import { automationRuleService } from '@/services/automationRuleService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { ANOMALY_SCAN_RULE_KEY, findAnomalyScanRule, scanSummary } from '@/lib/anomaly';

const RULES_QUERY_KEY = 'automation-rules';
const ANOMALIES_QUERY_KEY = 'anomalies';

/** Workspace-level controls for the anomaly scan: the on/off switch and a
 *  "Run scan now" button. Shown only to people who may read automation rules;
 *  only those who may configure them can flip the switch or run a scan. */
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

  const scan = useMutation({
    mutationFn: () => anomalyService.scanNow(),
    onSuccess: (result) => {
      toast.success(scanSummary(result));
      queryClient.invalidateQueries({ queryKey: [ANOMALIES_QUERY_KEY] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'The scan did not finish.'));
      queryClient.invalidateQueries({ queryKey: [RULES_QUERY_KEY] });
    },
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
      {canConfigure && (
        <button
          type="button"
          onClick={() => scan.mutate()}
          disabled={!rule.enabled || scan.isPending}
          aria-label="Run scan now"
          title={rule.enabled ? 'Check for anomalies right now' : 'Turn scanning on to run a scan'}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {scan.isPending ? (
            <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden="true" />
          )}
          {scan.isPending ? 'Scanning…' : 'Run scan now'}
        </button>
      )}
    </div>
  );
}
