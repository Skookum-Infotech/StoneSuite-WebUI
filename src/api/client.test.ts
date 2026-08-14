import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';

import { apiClient } from './client';
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
