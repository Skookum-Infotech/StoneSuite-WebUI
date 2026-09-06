import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/store/useAuthStore', () => ({ isPortalSession: vi.fn() }));

import { tenantClient } from '@/api/tenantClient';
import { isPortalSession } from '@/store/useAuthStore';
import { workflowService } from './tenantServices';

function notFound(): AxiosError {
  const err = new AxiosError('Not Found');
  err.response = { status: 404, data: {}, statusText: 'Not Found', headers: {}, config: {} } as never;
  return err;
}

function serverError(): AxiosError {
  const err = new AxiosError('Server Error');
  err.response = { status: 500, data: {}, statusText: 'Server Error', headers: {}, config: {} } as never;
  return err;
}

describe('workflowService.listEnabled', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads /tenant/workflows/enabled for a staff session', async () => {
    vi.mocked(isPortalSession).mockReturnValue(false);
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, workflows: [] } });

    await workflowService.listEnabled();

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/workflows/enabled');
  });

  it('reads /portal/workflows/enabled for a portal session', async () => {
    vi.mocked(isPortalSession).mockReturnValue(true);
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, workflows: [] } });

    await workflowService.listEnabled();

    expect(tenantClient.get).toHaveBeenCalledWith('/portal/workflows/enabled');
  });

  // The bug this whole change exists to fix: a portal token calling the
  // route before the backend ships it must fail open, not throw.
  it('resolves to an empty list on a 404 for a portal session', async () => {
    vi.mocked(isPortalSession).mockReturnValue(true);
    vi.mocked(tenantClient.get).mockRejectedValue(notFound());

    await expect(workflowService.listEnabled()).resolves.toEqual([]);
  });

  it('still rejects a non-404 failure for a portal session', async () => {
    vi.mocked(isPortalSession).mockReturnValue(true);
    vi.mocked(tenantClient.get).mockRejectedValue(serverError());

    await expect(workflowService.listEnabled()).rejects.toThrow();
  });

  // Proves the 404 fallback is portal-only — a staff session with a genuinely
  // missing route should surface the failure like any other API error.
  it('rejects a 404 for a staff session', async () => {
    vi.mocked(isPortalSession).mockReturnValue(false);
    vi.mocked(tenantClient.get).mockRejectedValue(notFound());

    await expect(workflowService.listEnabled()).rejects.toThrow();
  });
});
