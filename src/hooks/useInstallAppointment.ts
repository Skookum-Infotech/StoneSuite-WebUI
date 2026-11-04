import { useQuery } from '@tanstack/react-query';
import { installScheduleService } from '@/services/installScheduleService';
import { INSTALL_APPOINTMENTS_KEY } from '@/hooks/useInstallAppointments';

/** One visit by id, for the edit dialog. Stays idle without an id. */
export function useInstallAppointment(id: string | undefined) {
  return useQuery({
    queryKey: [INSTALL_APPOINTMENTS_KEY, 'detail', id],
    queryFn: () => installScheduleService.getAppointment(id as string),
    enabled: Boolean(id),
  });
}
