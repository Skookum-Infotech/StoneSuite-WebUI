import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { automationSettingsService } from '@/services/automationSettingsService';

export const AUTOMATION_RULES_QUERY_KEY = 'automation-rules';
export const AUTOMATION_SETTINGS_QUERY_KEY = 'automation-settings';

/** Pauses or resumes every automated email for the workspace (PUT .../automation/settings). */
export function useAutomationKillSwitch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (killSwitch: boolean) => automationSettingsService.setKillSwitch(killSwitch),
    onSuccess: (settings) => {
      toast.success(settings.killSwitch ? 'Automated emails paused' : 'Automated emails resumed');
      queryClient.invalidateQueries({ queryKey: [AUTOMATION_SETTINGS_QUERY_KEY] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not change the pause setting.')),
  });
}
