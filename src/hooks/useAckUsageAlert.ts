import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { platformUsageService } from '@/services/platformUsageService';
import type { SnoozeDays } from '@/types/platformUsage';

/** Root query key for everything on the Tenant Usage pages. */
export const PLATFORM_USAGE_KEY = 'platform-usage';

interface AckVars {
  alertId: string;
  snoozeDays?: SnoozeDays;
}

/** Acknowledge or snooze a usage alert, then refresh the watch list, the
 *  overview and any open tenant detail. */
export function useAckUsageAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, snoozeDays }: AckVars) => platformUsageService.ackAlert(alertId, snoozeDays),
    onSuccess: (_data, { snoozeDays }) => {
      toast.success(snoozeDays ? `Alert snoozed for ${snoozeDays} days` : 'Alert acknowledged');
      return qc.invalidateQueries({ queryKey: [PLATFORM_USAGE_KEY] });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, 'Could not update the alert. Try again.'));
    },
  });
}
