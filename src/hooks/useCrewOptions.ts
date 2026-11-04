import { useQuery } from '@tanstack/react-query';
import { installScheduleService } from '@/services/installScheduleService';
import { INSTALL_APPOINTMENTS_KEY } from '@/hooks/useInstallAppointments';

/** Employees who can be assigned to a visit. */
export function useCrewOptions(enabled: boolean) {
  return useQuery({
    queryKey: [INSTALL_APPOINTMENTS_KEY, 'crew-options'],
    queryFn: installScheduleService.getCrewOptions,
    enabled,
  });
}
