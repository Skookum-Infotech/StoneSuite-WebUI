import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';

// client.ts keeps `isLoggingOut` in module scope (it resets on a hard page
// navigation in the browser), so each test loads a fresh copy of the module
// graph — otherwise the first forced logout would silence every later one.
async function loadFresh() {
  vi.resetModules();
  const client = await import('./client');
  const notice = await import('@/lib/authNotice');
  const { useAuthStore } = await import('@/store/useAuthStore');
  return { apiClient: client.apiClient, notice, useAuthStore };
}

type Stub = { status: number; data: unknown };

/** Routes every request to a canned response, rejecting (like axios) on >= 400. */
function stubAdapter(
  apiClient: Awaited<ReturnType<typeof loadFresh>>['apiClient'],
  routes: Record<string, Stub>,
): string[] {
  const calls: string[] = [];
  apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const url = config.url ?? '';
    calls.push(url);
    const stub = Object.entries(routes).find(([suffix]) => url.endsWith(suffix))?.[1] ?? { status: 200, data: {} };
    const response = { data: stub.data, status: stub.status, statusText: '', headers: {}, config };
    if (stub.status >= 400) {
      throw new AxiosError('request failed', undefined, config, undefined, response);
    }
    return response;
  };
  return calls;
}

const SUSPENDED = {
  code: 'workspace_suspended',
  message: 'This workspace is suspended. Please contact your account administrator.',
};

describe('apiClient — workspace unavailable', () => {
  let location: { href: string };

  beforeEach(() => {
    location = { href: '/dashboard' };
    vi.stubGlobal('location', location);
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('ends the session and remembers why when a call is refused because the workspace is suspended', async () => {
    const { apiClient, notice, useAuthStore } = await loadFresh();
    useAuthStore.setState({ token: 'jwt', isAuthenticated: true });
    const calls = stubAdapter(apiClient, { '/tenant/leads': { status: 403, data: SUSPENDED } });

    await expect(apiClient.get('/tenant/leads')).rejects.toBeInstanceOf(AxiosError);

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(notice.peekAuthNotice()).toBe(SUSPENDED.message);
    expect(location.href).toBe('/auth/login');
    expect(calls).toContain('/auth/logout');
  });

  it('leaves an ordinary 403 (missing permission) alone', async () => {
    const { apiClient, notice, useAuthStore } = await loadFresh();
    useAuthStore.setState({ token: 'jwt', isAuthenticated: true });
    stubAdapter(apiClient, { '/tenant/leads': { status: 403, data: { message: 'Forbidden.' } } });

    await expect(apiClient.get('/tenant/leads')).rejects.toBeInstanceOf(AxiosError);

    expect(useAuthStore.getState().token).toBe('jwt');
    expect(notice.peekAuthNotice()).toBeNull();
    expect(location.href).toBe('/dashboard');
  });

  it('does not intercept the sign-in call itself — the form shows that error inline', async () => {
    const { apiClient, notice } = await loadFresh();
    stubAdapter(apiClient, { '/auth/tenant-login': { status: 403, data: SUSPENDED } });

    await expect(apiClient.post('/auth/tenant-login', {})).rejects.toBeInstanceOf(AxiosError);

    expect(notice.peekAuthNotice()).toBeNull();
    expect(location.href).toBe('/dashboard');
  });

  it('carries the reason to the login page when an expired token cannot be refreshed because the workspace is suspended', async () => {
    const { apiClient, notice } = await loadFresh();
    stubAdapter(apiClient, {
      '/tenant/leads': { status: 401, data: { message: 'Token expired.' } },
      '/auth/refresh': { status: 403, data: SUSPENDED },
    });

    await expect(apiClient.get('/tenant/leads')).rejects.toBeInstanceOf(AxiosError);

    expect(notice.peekAuthNotice()).toBe(SUSPENDED.message);
    expect(location.href).toBe('/auth/login');
  });

  it('still signs out silently when the refresh fails for any other reason', async () => {
    const { apiClient, notice } = await loadFresh();
    stubAdapter(apiClient, {
      '/tenant/leads': { status: 401, data: { message: 'Token expired.' } },
      '/auth/refresh': { status: 401, data: { message: 'Refresh token expired. Please sign in again.' } },
    });

    await expect(apiClient.get('/tenant/leads')).rejects.toBeInstanceOf(AxiosError);

    expect(notice.peekAuthNotice()).toBeNull();
    expect(location.href).toBe('/auth/login');
  });
});
