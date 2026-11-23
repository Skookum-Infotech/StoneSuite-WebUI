import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/store/useAuthStore', () => ({ isPortalSession: vi.fn() }));

import { tenantClient } from '@/api/tenantClient';
import { isPortalSession } from '@/store/useAuthStore';
import { platformService, workflowService } from './tenantServices';

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

describe('platformService.listTenants', () => {
  beforeEach(() => vi.clearAllMocks());

  const tenant = (id: string) => ({ id }) as never;

  it('follows nextCursor until the server stops returning one, passing it back unchanged', async () => {
    vi.mocked(tenantClient.get)
      .mockResolvedValueOnce({ data: { success: true, tenants: [tenant('a'), tenant('b')], nextCursor: 'opaque-1' } })
      .mockResolvedValueOnce({ data: { success: true, tenants: [tenant('c')], nextCursor: '' } });

    const result = await platformService.listTenants();

    expect(result.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(tenantClient.get).toHaveBeenNthCalledWith(1, '/platform/tenants', { params: { limit: 200 } });
    expect(tenantClient.get).toHaveBeenNthCalledWith(2, '/platform/tenants', { params: { limit: 200, cursor: 'opaque-1' } });
  });

  it('accepts a server that predates paging (everything in one response, no cursor)', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, tenants: [tenant('a')] } });

    expect(await platformService.listTenants()).toHaveLength(1);
    expect(tenantClient.get).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list when the response has no tenants field', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true } });

    expect(await platformService.listTenants()).toEqual([]);
  });

  it('gives up after a bounded number of pages instead of looping forever', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, tenants: [], nextCursor: 'again' } });

    await platformService.listTenants();

    expect(vi.mocked(tenantClient.get).mock.calls.length).toBeLessThanOrEqual(500);
  });
});

describe('platformService.purgeTenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs the typed slug to the purge endpoint', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true } });

    const result = await platformService.purgeTenant('t-1', 'acme');

    expect(tenantClient.post).toHaveBeenCalledWith('/platform/tenants/t-1/purge', { confirmSlug: 'acme' });
    expect(result).toEqual({ success: true });
  });

  it('lets a backend refusal propagate to the caller', async () => {
    vi.mocked(tenantClient.post).mockRejectedValue(serverError());

    await expect(platformService.purgeTenant('t-1', 'acme')).rejects.toThrow();
  });
});

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
