import { useQuery } from '@tanstack/react-query';
import { installScheduleService } from '@/services/installScheduleService';

export const INSTALL_APPOINTMENTS_KEY = 'install-appointments';
// Same cadence as the Activity Planner: a shared board should pick up a
// colleague's booking without a manual reload.
const POLL_MS = 60_000;

/** The visits in one date window, optionally for one crew member. `enabled`
 *  holds the request back until the caller's permissions are known. */
export function useInstallAppointments(
  range: { from: string; to: string },
  employeeId: number | null,
  enabled: boolean,
) {
  const query = useQuery({
    queryKey: [INSTALL_APPOINTMENTS_KEY, 'feed', { from: range.from, to: range.to, employeeId }],
    queryFn: () => installScheduleService.getFeed({ from: range.from, to: range.to, employeeId }),
    enabled,
    refetchInterval: POLL_MS,
    // Carry the previous window across while the next loads.
    placeholderData: (previous) => previous,
  });
  return {
    appointments: query.data?.appointments ?? [],
    truncated: query.data?.truncated ?? false,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    // True while the visits on hand belong to the previous window.
    isPlaceholderData: query.isPlaceholderData,
    error: query.error,
    refetch: query.refetch,
  };
}
