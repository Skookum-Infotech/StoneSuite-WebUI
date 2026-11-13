// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';

// client.ts keeps refresh/logout state in module scope, so each test loads a
// fresh copy of the module graph (same approach as client.workspaceUnavailable).
async function loadFresh() {
  vi.resetModules();
  const client = await import('./client');
  const { useAuthStore } = await import('@/store/useAuthStore');
  return { client, useAuthStore };
}

type Stub = { status: number; data: unknown };

function stubAdapter(
  apiClient: Awaited<ReturnType<typeof loadFresh>>['client']['apiClient'],
  routes: Record<string, Stub>,
): string[] {
  const calls: string[] = [];
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    calls.push(url);
    const stub = Object.entries(routes).find(([suffix]) => url.endsWith(suffix))?.[1] ?? { status: 200, data: {} };
    const response = { data: stub.data, status: stub.status, statusText: '', headers: {}, config };
    if (stub.status >= 400) throw new AxiosError('request failed', undefined, config, undefined, response);
    return response;
  };
  return calls;
}

const REPLACED = { success: false, code: 'session_replaced', message: 'Your account was signed in on another computer.' };

describe('apiClient — session replaced by a sign-in elsewhere', () => {
  let location: { href: string };

  beforeEach(() => {
    location = { href: '/dashboard' };
    vi.stubGlobal('location', location);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['a write during the handover (409)', 409],
    ['any request after it (401)', 401],
  ])('shows the countdown instead of refreshing or logging out on %s', async (_name, status) => {
    const { client, useAuthStore } = await loadFresh();
    useAuthStore.setState({ token: 'jwt', isAuthenticated: true, replacedSession: null });
    const calls = stubAdapter(client.apiClient, { '/tenant/leads': { status, data: REPLACED } });

    await expect(client.apiClient.post('/tenant/leads', {})).rejects.toBeInstanceOf(AxiosError);

    expect(useAuthStore.getState().replacedSession).toEqual({});
    expect(calls).not.toContain('/auth/refresh');
    expect(calls).not.toContain('/auth/logout');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(location.href).toBe('/dashboard');
  });

  it('reports a refused refresh as replaced, not rejected', async () => {
    const { client, useAuthStore } = await loadFresh();
    useAuthStore.setState({ token: 'jwt', isAuthenticated: true, replacedSession: null });
    stubAdapter(client.apiClient, { '/auth/refresh': { status: 401, data: REPLACED } });

    await expect(client.attemptRefresh()).resolves.toBe('replaced');
    expect(useAuthStore.getState().replacedSession).not.toBeNull();
    expect(location.href).toBe('/dashboard');
  });

  it('keeps the first report so the countdown is never restarted', async () => {
    const { client, useAuthStore } = await loadFresh();
    useAuthStore.setState({ isAuthenticated: true, replacedSession: null });

    client.reportSessionReplaced({ deviceLabel: 'Edge on Windows', endsAt: 1 });
    client.reportSessionReplaced({ deviceLabel: 'Other', endsAt: 2 });

    expect(useAuthStore.getState().replacedSession).toEqual({ deviceLabel: 'Edge on Windows', endsAt: 1 });
  });

  it('ignores a report once signed out', async () => {
    const { client, useAuthStore } = await loadFresh();
    useAuthStore.setState({ isAuthenticated: false, replacedSession: null });
    client.reportSessionReplaced({});
    expect(useAuthStore.getState().replacedSession).toBeNull();
  });

  it('refreshes and retries when a token predates sessions (switch-role)', async () => {
    const { client, useAuthStore } = await loadFresh();
    useAuthStore.setState({ token: 'old', isAuthenticated: true, replacedSession: null });
    let switchCalls = 0;
    const calls: string[] = [];
    client.apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const url = config.url ?? '';
      calls.push(url);
      if (url.endsWith('/auth/refresh')) {
        return { data: { success: true, token: 'new', expiresAt: Date.now() + 3_600_000 }, status: 200, statusText: '', headers: {}, config };
      }
      switchCalls += 1;
      if (switchCalls === 1) {
        throw new AxiosError('refresh needed', undefined, config, undefined, {
          data: { success: false, code: 'session_refresh_required' }, status: 401, statusText: '', headers: {}, config,
        } as never);
      }
      return { data: { success: true }, status: 200, statusText: '', headers: {}, config };
    };

    await expect(client.apiClient.post('/tenant/auth/switch-role', {})).resolves.toBeTruthy();
    expect(calls).toEqual(['/tenant/auth/switch-role', '/auth/refresh', '/tenant/auth/switch-role']);
    expect(useAuthStore.getState().replacedSession).toBeNull();
  });

  it('with awaitServer, waits for the logout call before leaving the page', async () => {
    const { client, useAuthStore } = await loadFresh();
    useAuthStore.setState({ token: 'jwt', isAuthenticated: true });
    const pending: { release?: () => void } = {};
    client.apiClient.defaults.adapter = (config: InternalAxiosRequestConfig) =>
      new Promise((resolve) => {
        pending.release = () => resolve({ data: { success: true }, status: 200, statusText: '', headers: {}, config });
      });

    client.forceLogout('bye', { awaitServer: true });
    await vi.waitFor(() => expect(pending.release).toBeDefined());
    expect(location.href).toBe('/dashboard');
    pending.release?.();
    await vi.waitFor(() => expect(location.href).toBe('/auth/login'));
  });
});
