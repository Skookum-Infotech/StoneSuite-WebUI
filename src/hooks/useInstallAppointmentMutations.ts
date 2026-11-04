import { useMutation, useQueryClient } from '@tanstack/react-query';
import { installScheduleService } from '@/services/installScheduleService';
import { INSTALL_APPOINTMENTS_KEY } from '@/hooks/useInstallAppointments';
import type {
  AppointmentWriteResult,
  CancelAppointmentInput,
  CompleteAppointmentInput,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '@/types/installSchedule';

/** Create, update, cancel and complete a visit. Every success refreshes the
 *  schedule views and the visit's fabrication job. */
export function useInstallAppointmentMutations() {
  const queryClient = useQueryClient();

  const refresh = (result: AppointmentWriteResult) => {
    void queryClient.invalidateQueries({ queryKey: [INSTALL_APPOINTMENTS_KEY] });
    void queryClient.invalidateQueries({ queryKey: ['fabrication-job', result.appointment.fabricationJobId] });
  };

  const create = useMutation({
    mutationFn: (input: CreateAppointmentInput) => installScheduleService.createAppointment(input),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAppointmentInput }) =>
      installScheduleService.updateAppointment(id, input),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CancelAppointmentInput }) =>
      installScheduleService.cancelAppointment(id, input),
    onSuccess: refresh,
  });
  const complete = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CompleteAppointmentInput }) =>
      installScheduleService.completeAppointment(id, input),
    onSuccess: refresh,
  });

  return { create, update, cancel, complete };
}
