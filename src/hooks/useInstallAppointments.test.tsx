import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';

vi.mock('@/services/installScheduleService');

import { installScheduleService } from '@/services/installScheduleService';
import { INSTALL_APPOINTMENTS_KEY, useInstallAppointments } from './useInstallAppointments';

const RANGE = { from: '2026-11-09', to: '2026-11-15' };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(installScheduleService.getFeed).mockResolvedValue({ appointments: [], truncated: true, timezone: 'America/Chicago' });
});

describe('useInstallAppointments', () => {
  it('requests the feed with the range and employee, and exposes the result', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useInstallAppointments(RANGE, 12, true), { wrapper });
    await waitFor(() => expect(result.current.truncated).toBe(true));
    expect(installScheduleService.getFeed).toHaveBeenCalledWith({ from: RANGE.from, to: RANGE.to, employeeId: 12 });
    expect(result.current.appointments).toEqual([]);
  });

  it('keys the cache by employee id', async () => {
    const { client, wrapper } = setup();
    const { result, rerender } = renderHook(({ id }) => useInstallAppointments(RANGE, id, true), {
      wrapper,
      initialProps: { id: 12 as number | null },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({ id: null });
    await waitFor(() => expect(installScheduleService.getFeed).toHaveBeenCalledTimes(2));
    expect(client.getQueryCache().find({ queryKey: [INSTALL_APPOINTMENTS_KEY, 'feed', { ...RANGE, employeeId: 12 }] })).toBeDefined();
    expect(client.getQueryCache().find({ queryKey: [INSTALL_APPOINTMENTS_KEY, 'feed', { ...RANGE, employeeId: null }] })).toBeDefined();
  });

  it('does not fetch while disabled', () => {
    const { wrapper } = setup();
    renderHook(() => useInstallAppointments(RANGE, null, false), { wrapper });
    expect(installScheduleService.getFeed).not.toHaveBeenCalled();
  });
});
