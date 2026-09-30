import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';

import { apiClient, attemptRefresh } from './client';
import { useAuthStore } from '@/store/useAuthStore';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'X-CSRF-Token';

/** Removes every cookie jsdom currently holds for this document. */
function clearCookies(): void {
  for (const pair of document.cookie.split(';')) {
    const name = pair.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

/**
 * Drives a real request through apiClient's interceptor chain and returns the
 * config the adapter was ultimately handed. Using a stub adapter (rather than
 * calling the interceptor directly) keeps the test honest about the axios
 * plumbing that actually runs in the browser.
 */
async function captureRequestConfig(): Promise<InternalAxiosRequestConfig> {
  let captured: InternalAxiosRequestConfig | undefined;

  await apiClient.request({
    url: '/anything',
    method: 'post',
    adapter: async (config) => {
      captured = config;
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    },
  });

  if (!captured) throw new Error('adapter was never invoked');
  return captured;
}

describe('apiClient request interceptor', () => {
  beforeEach(() => {
    clearCookies();
    useAuthStore.setState({ token: null });
  });

  afterEach(() => {
    clearCookies();
    useAuthStore.setState({ token: null });
  });

  describe('X-CSRF-Token', () => {
    // The backend's double-submit check (middleware/csrf.go) requires this
    // header to exactly equal the csrf_token cookie on every mutating request.
    const cases: { name: string; cookieValue: string; expected: string }[] = [
      { name: 'attaches the cookie value verbatim', cookieValue: 'abc123', expected: 'abc123' },
      {
        name: 'url-decodes an encoded cookie value',
        cookieValue: encodeURIComponent('a b+c/d'),
        expected: 'a b+c/d',
      },
    ];

    for (const { name, cookieValue, expected } of cases) {
      it(name, async () => {
        document.cookie = `${CSRF_COOKIE}=${cookieValue}; path=/`;

        const config = await captureRequestConfig();

        expect(config.headers.get(CSRF_HEADER)).toBe(expected);
      });
    }

    it('omits the header entirely when the cookie is absent', async () => {
      const config = await captureRequestConfig();

      expect(config.headers.get(CSRF_HEADER)).toBeUndefined();
    });

    it('reads csrf_token even when other cookies surround it', async () => {
      document.cookie = 'other_first=1; path=/';
      document.cookie = `${CSRF_COOKIE}=middle-value; path=/`;
      document.cookie = 'other_last=2; path=/';

      const config = await captureRequestConfig();

      expect(config.headers.get(CSRF_HEADER)).toBe('middle-value');
    });

    it('does not confuse a cookie whose name merely ends in csrf_token', async () => {
      document.cookie = `not_${CSRF_COOKIE}=wrong; path=/`;

      const config = await captureRequestConfig();

      expect(config.headers.get(CSRF_HEADER)).toBeUndefined();
    });
  });

  describe('Authorization', () => {
    it('attaches the in-memory token as a Bearer header', async () => {
      useAuthStore.setState({ token: 'jwt-value' });

      const config = await captureRequestConfig();

      expect(config.headers.Authorization).toBe('Bearer jwt-value');
    });

    it('omits the header when no token is held', async () => {
      const config = await captureRequestConfig();

      expect(config.headers.Authorization).toBeUndefined();
    });
  });

  it('sends cookies with every request', () => {
    // withCredentials is what makes the httpOnly auth_token/refresh_token
    // cookies accompany the request the CSRF header is validated against.
    expect(apiClient.defaults.withCredentials).toBe(true);
  });
});

describe('attemptRefresh (staff session)', () => {
  const realAdapter = apiClient.defaults.adapter;

  beforeEach(() => {
    clearCookies();
    useAuthStore.setState({ token: null, kind: undefined, sessionExpiresAt: null });
  });

  afterEach(() => {
    apiClient.defaults.adapter = realAdapter;
    clearCookies();
    useAuthStore.setState({ token: null, sessionExpiresAt: null });
  });

  it('stores the re-issued access token, not just the new expiry', async () => {
    // /auth/refresh (RefreshSession) returns a fresh token in the body — a
    // cross-origin client (notifyClient) has no cookie fallback, so the
    // in-memory token must be repopulated or it stays unauthenticated until
    // the next full login.
    const expiresAt = Date.now() + 60_000;
    apiClient.defaults.adapter = async (config) => {
      if (!config.url?.endsWith('/auth/refresh')) throw new Error(`unexpected call: ${config.url}`);
      return {
        data: { success: true, token: 'fresh-jwt', expiresAt },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    const ok = await attemptRefresh();

    expect(ok).toBe('ok');
    expect(useAuthStore.getState().token).toBe('fresh-jwt');
    expect(useAuthStore.getState().sessionExpiresAt).toBe(expiresAt);
  });

  // A reload that lands on a cold (scale-to-zero) backend, or a blip mid-refresh,
  // must never read as "the session is dead" — that is what logged users out.
  describe('failed refresh', () => {
    const failWith = (status?: number) => {
      apiClient.defaults.adapter = async (config) => {
        if (status === undefined) throw new Error('Network Error'); // no response at all
        const response = { data: { success: false }, status, statusText: '', headers: {}, config };
        throw Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, config, response });
      };
    };

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([401, 403])('is `rejected` on HTTP %i, so the caller logs out', async (status) => {
      failWith(status);
      expect(await attemptRefresh()).toBe('rejected');
    });

    it.each([
      ['a network error', undefined],
      ['a 502 from a cold start', 502],
      ['a 503', 503],
      ['a 500', 500],
    ] as const)('is `transient` after retries on %s, never `rejected`', async (_label, status) => {
      vi.useFakeTimers();
      failWith(status);
      const pending = attemptRefresh();
      await vi.runAllTimersAsync();
      expect(await pending).toBe('transient');
    });

    it('recovers when the backend comes up during the retry window', async () => {
      vi.useFakeTimers();
      let calls = 0;
      apiClient.defaults.adapter = async (config) => {
        calls += 1;
        if (calls < 3) {
          throw Object.assign(new Error('HTTP 502'), {
            isAxiosError: true, config, response: { status: 502, data: {}, statusText: '', headers: {}, config },
          });
        }
        return { data: { success: true, token: 'jwt', expiresAt: Date.now() + 60_000 }, status: 200, statusText: 'OK', headers: {}, config };
      };
      const pending = attemptRefresh();
      await vi.runAllTimersAsync();
      expect(await pending).toBe('ok');
      expect(calls).toBe(3);
    });
  });
});
