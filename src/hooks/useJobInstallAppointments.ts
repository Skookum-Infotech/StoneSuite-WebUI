import { useQuery } from '@tanstack/react-query';
import { installScheduleService } from '@/services/installScheduleService';
import { INSTALL_APPOINTMENTS_KEY } from '@/hooks/useInstallAppointments';

/** Every visit booked for one fabrication job. `enabled` holds the request back
 *  until the caller knows it may read visits. */
export function useJobInstallAppointments(jobId: string, enabled: boolean) {
  return useQuery({
    queryKey: [INSTALL_APPOINTMENTS_KEY, 'job', jobId],
    queryFn: () => installScheduleService.listForJob(jobId),
    enabled: enabled && Boolean(jobId),
  });
}
