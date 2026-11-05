import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';

vi.mock('@/api/tenantClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  tenantClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { installScheduleService, isConflictError, isStaleError } from './installScheduleService';

function httpError(status: number, data: Record<string, unknown>): AxiosError {
  const err = new AxiosError('Request failed');
  err.response = { status, data } as AxiosError['response'];
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('installScheduleService', () => {
  it('sends the feed window and only the optional filters that are set', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, appointments: [{ id: 'a' }], truncated: false, timezone: 'America/Chicago' } });
    const feed = await installScheduleService.getFeed({ from: '2026-11-09', to: '2026-11-15', employeeId: null });
    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/install-appointments', { params: { from: '2026-11-09', to: '2026-11-15' } });
    expect(feed.appointments).toHaveLength(1);
    await installScheduleService.getFeed({ from: 'a', to: 'b', employeeId: 7, includeCancelled: true });
    expect(vi.mocked(tenantClient.get).mock.calls[1][1]).toEqual({ params: { from: 'a', to: 'b', employeeId: 7, includeCancelled: true } });
  });

  it('unwraps write responses and defaults emailSent to false', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, appointment: { id: 'a' } } });
    const res = await installScheduleService.cancelAppointment('a', { expectedVersion: 2, reason: 'rain' });
    expect(tenantClient.post).toHaveBeenCalledWith('/tenant/install-appointments/a/cancel', { expectedVersion: 2, reason: 'rain' });
    expect(res).toEqual({ appointment: { id: 'a' }, emailSent: false });
  });

  it('patches an update, lists a job\'s visits and unwraps crew options and history', async () => {
    vi.mocked(tenantClient.patch).mockResolvedValue({ data: { appointment: { id: 'a' }, emailSent: true } });
    expect((await installScheduleService.updateAppointment('a', { expectedVersion: 1 })).emailSent).toBe(true);
    expect(tenantClient.patch).toHaveBeenCalledWith('/tenant/install-appointments/a', { expectedVersion: 1 });
    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { appointments: [{ id: 'x' }] } });
    expect(await installScheduleService.listForJob('job-1')).toEqual([{ id: 'x' }]);
    expect(vi.mocked(tenantClient.get).mock.calls[0][0]).toBe('/tenant/fabrication-jobs/job-1/install-appointments');
    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { crew: [{ employeeId: 1, name: 'A', hasLogin: true }] } });
    expect(await installScheduleService.getCrewOptions()).toHaveLength(1);
    vi.mocked(tenantClient.get).mockResolvedValueOnce({ data: { history: [{ id: 1 }] } });
    expect(await installScheduleService.getHistory('a')).toEqual([{ id: 1 }]);
  });
});

describe('error guards', () => {
  it.each([
    ['conflict 409', httpError(409, { code: 'conflict', conflicts: [] }), true, false],
    ['stale 409', httpError(409, { code: 'stale_version', currentVersion: 4 }), false, true],
    ['other 409', httpError(409, { code: 'job_closed' }), false, false],
    ['conflict code on 400', httpError(400, { code: 'conflict' }), false, false],
    ['plain error', new Error('x'), false, false],
    ['null', null, false, false],
  ])('%s', (_name, err, conflict, stale) => {
    expect(isConflictError(err)).toBe(conflict);
    expect(isStaleError(err)).toBe(stale);
  });
});
