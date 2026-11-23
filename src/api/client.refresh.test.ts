import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { apiClient, attemptRefresh, invalidateSession, isRefreshInFlight } from './client';
import { useAuthStore } from '@/store/useAuthStore';

const ok = (expiresAt: number) =>
  ({ data: { success: true, token: 't', expiresAt } }) as AxiosResponse;

function httpError(status: number): AxiosError {
  return new AxiosError('x', String(status), undefined, undefined, { status } as AxiosResponse);
}

describe('attemptRefresh', () => {
  let post: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    useAuthStore.setState({ kind: 'staff', sessionExpiresAt: Date.now() + 1_000 } as never);
    post = vi.spyOn(apiClient, 'post');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'locks');
  });

  it('shares one request between concurrent callers (single flight)', async () => {
    post.mockResolvedValue(ok(Date.now() + 3_600_000));
    const [a, b, c] = await Promise.all([attemptRefresh(), attemptRefresh(), attemptRefresh()]);
    expect([a, b, c]).toEqual(['ok', 'ok', 'ok']);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('a slow refresh is awaited and reported in flight, then clears', async () => {
    let finish!: (r: AxiosResponse) => void;
    post.mockReturnValue(new Promise<AxiosResponse>((r) => { finish = r; }));
    const p = attemptRefresh();
    expect(await isRefreshInFlight()).toBe(true);
    finish(ok(Date.now() + 3_600_000));
    expect(await p).toBe('ok');
    expect(await isRefreshInFlight()).toBe(false);
  });

  it('retries a network failure and recovers without ending the session', async () => {
    post.mockRejectedValueOnce(new AxiosError('Network Error')).mockResolvedValue(ok(Date.now() + 3_600_000));
    const p = attemptRefresh();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await p).toBe('ok');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('reports transient (not rejected) when the backend stays unreachable', async () => {
    post.mockRejectedValue(httpError(503));
    const p = attemptRefresh();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await p).toBe('transient');
  });

  it('reports rejected on a 401 from the server', async () => {
    post.mockRejectedValue(httpError(401));
    expect(await attemptRefresh()).toBe('rejected');
  });

  it('discards a refresh that finishes after the user logged out', async () => {
    let finish!: (r: AxiosResponse) => void;
    post.mockReturnValue(new Promise<AxiosResponse>((r) => { finish = r; }));
    const before = useAuthStore.getState().sessionExpiresAt;
    const p = attemptRefresh();
    invalidateSession();
    finish(ok(Date.now() + 3_600_000));
    expect(await p).toBe('rejected');
    expect(useAuthStore.getState().sessionExpiresAt).toBe(before);
  });

  it('skips its own refresh when another tab already extended the session', async () => {
    let grant!: () => void;
    const gate = new Promise<void>((r) => { grant = r; });
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: async (_n: string, cb: () => Promise<unknown>) => { await gate; return cb(); },
        query: async () => ({ held: [], pending: [] }),
      },
    });
    const p = attemptRefresh();
    // The other tab finishes first and broadcasts the new expiry.
    useAuthStore.setState({ sessionExpiresAt: Date.now() + 3_600_000 } as never);
    grant();
    expect(await p).toBe('ok');
    expect(post).not.toHaveBeenCalled();
  });
});
