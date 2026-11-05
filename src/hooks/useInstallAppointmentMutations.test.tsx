import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';

vi.mock('@/services/installScheduleService');

import { installScheduleService } from '@/services/installScheduleService';
import { useInstallAppointmentMutations } from './useInstallAppointmentMutations';
import type { Appointment, CreateAppointmentInput } from '@/types/installSchedule';

const JOB = 'job-uuid-1';
const APPT = { id: 'appt-1', fabricationJobId: JOB, version: 1 } as Appointment;
const CREATE: CreateAppointmentInput = {
  fabricationJobId: JOB, visitType: 'install', startLocal: '2026-11-10T08:00', endLocal: '2026-11-10T12:00',
  allDay: false, crew: [], requestId: 'req-1',
};

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const spy = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { spy, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  const result = { appointment: APPT, emailSent: false };
  vi.mocked(installScheduleService.createAppointment).mockResolvedValue(result);
  vi.mocked(installScheduleService.updateAppointment).mockResolvedValue(result);
  vi.mocked(installScheduleService.cancelAppointment).mockResolvedValue(result);
  vi.mocked(installScheduleService.completeAppointment).mockResolvedValue(result);
});

describe('useInstallAppointmentMutations', () => {
  it('invalidates the schedule and the job after a create', async () => {
    const { spy, wrapper } = setup();
    const { result } = renderHook(() => useInstallAppointmentMutations(), { wrapper });
    act(() => result.current.create.mutate(CREATE));
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(installScheduleService.createAppointment).toHaveBeenCalledWith(CREATE);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['install-appointments'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['fabrication-job', JOB] });
  });

  it.each([
    ['update', 'updateAppointment', { id: 'appt-1', input: { expectedVersion: 1, notes: 'x' } }],
    ['cancel', 'cancelAppointment', { id: 'appt-1', input: { expectedVersion: 1, reason: 'weather' } }],
    ['complete', 'completeAppointment', { id: 'appt-1', input: { expectedVersion: 1 } }],
  ] as const)('%s calls the service with the id and input and invalidates', async (name, method, vars) => {
    const { spy, wrapper } = setup();
    const { result } = renderHook(() => useInstallAppointmentMutations(), { wrapper });
    act(() => (result.current[name].mutate as (v: typeof vars) => void)(vars));
    await waitFor(() => expect(result.current[name].isSuccess).toBe(true));
    expect(installScheduleService[method]).toHaveBeenCalledWith(vars.id, vars.input);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['install-appointments'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['fabrication-job', JOB] });
  });

  it('does not invalidate when the write fails', async () => {
    vi.mocked(installScheduleService.createAppointment).mockRejectedValue(new Error('boom'));
    const { spy, wrapper } = setup();
    const { result } = renderHook(() => useInstallAppointmentMutations(), { wrapper });
    act(() => result.current.create.mutate(CREATE));
    await waitFor(() => expect(result.current.create.isError).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
