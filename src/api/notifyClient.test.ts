import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';

// Mock the shared client module so this test controls the refresh outcome and
// doesn't pull apiClient's own interceptor side effects into scope.
vi.mock('./client', () => ({
  attemptRefresh: vi.fn(),
}));

import { notifyClient } from './notifyClient';
import { attemptRefresh } from './client';
import { useAuthStore } from '@/store/useAuthStore';

const refreshMock = vi.mocked(attemptRefresh);

interface StubResponse {
  status: number;
  data?: unknown;
}

/**
 * Drives a real GET through notifyClient's full interceptor chain with a stub
 * adapter that returns `responses` in order (the last entry repeats for any
 * further calls, e.g. a retry). A custom adapter owns status handling, so a
 * non-2xx entry is thrown as an AxiosError — exactly what the real adapters'
 * `settle` does — so the response interceptor's error path runs.
 */
function get(url: string, responses: StubResponse[]) {
  let call = 0;
  return notifyClient.get(url, {
    adapter: async (config) => {
      const r = responses[Math.min(call, responses.length - 1)];
      call += 1;
      const response = { data: r.data ?? {}, status: r.status, statusText: '', headers: {}, config };
      if (r.status >= 200 && r.status < 300) return response;
      throw new AxiosError(
        `Request failed with status code ${r.status}`,
        r.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
        config,
        undefined,
        response,
      );
    },
  });
}

describe('notifyClient', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    useAuthStore.setState({ token: null });
  });

  afterEach(() => {
    useAuthStore.setState({ token: null });
  });

  describe('request interceptor', () => {
    it('attaches the in-memory token as a Bearer header', async () => {
      useAuthStore.setState({ token: 'jwt-1' });
      let seen: InternalAxiosRequestConfig | undefined;

      await notifyClient.get('/api/notifications/summary', {
        adapter: async (config) => {
          seen = config;
          return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
        },
      });

      expect(seen?.headers.Authorization).toBe('Bearer jwt-1');
    });

    it('omits the Authorization header when no token is held', async () => {
      let seen: InternalAxiosRequestConfig | undefined;

      await notifyClient.get('/api/notifications/summary', {
        adapter: async (config) => {
          seen = config;
          return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
        },
      });

      expect(seen?.headers.Authorization).toBeUndefined();
    });
  });

  describe('401 refresh-and-retry', () => {
    it('refreshes once and retries when the refresh restores a token', async () => {
      refreshMock.mockImplementation(async () => {
        useAuthStore.setState({ token: 'jwt-refreshed' });
        return true;
      });

      const res = await get('/api/notifications/summary', [
        { status: 401, data: { success: false } },
        { status: 200, data: { success: true, data: { unreadCount: 4 } } },
      ]);

      expect(refreshMock).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(200);
      expect(res.data).toEqual({ success: true, data: { unreadCount: 4 } });
    });

    it('does not retry when the refresh succeeds but no token comes back', async () => {
      refreshMock.mockResolvedValue(true); // token deliberately left null

      await expect(
        get('/api/notifications/summary', [{ status: 401, data: { success: false } }]),
      ).rejects.toMatchObject({ response: { status: 401 } });

      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('rejects without retrying when the refresh fails', async () => {
      refreshMock.mockResolvedValue(false);

      await expect(
        get('/api/notifications/summary', [{ status: 401 }]),
      ).rejects.toMatchObject({ response: { status: 401 } });

      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('retries at most once even if the retry also 401s', async () => {
      refreshMock.mockImplementation(async () => {
        useAuthStore.setState({ token: 'jwt-refreshed' });
        return true;
      });

      await expect(
        get('/api/notifications/summary', [{ status: 401 }, { status: 401 }]),
      ).rejects.toMatchObject({ response: { status: 401 } });

      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('never triggers a refresh for a non-401 error', async () => {
      await expect(get('/api/notifications/summary', [{ status: 500 }])).rejects.toMatchObject({
        response: { status: 500 },
      });

      expect(refreshMock).not.toHaveBeenCalled();
    });
  });
});
