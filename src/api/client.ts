import axios, { type AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  // Send httpOnly cookies (auth_token + refresh_token) automatically on every request.
  withCredentials: true,
});

// Request interceptor: attach Authorization header as a fallback for environments
// that do not support cookies (e.g. React Native, some CORS configurations).
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track whether a token refresh is already in flight so concurrent 401s
// don't each spawn a separate refresh request.
let refreshPromise: Promise<boolean> | null = null;

// Track whether a logout is already in progress so multiple concurrent 401s
// each hitting the logout path don't each fire window.location redirects.
let isLoggingOut = false;

async function attemptRefresh(): Promise<boolean> {
  // Only one refresh at a time — share the promise across concurrent callers.
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await axios.post<{ success: boolean; token?: string; expiresAt?: number }>(
          `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        if (res.data.success && res.data.expiresAt) {
          useAuthStore.getState().setSessionExpiry(res.data.expiresAt);
          // Broadcast the new expiry to all other tabs.
          try {
            const ch = new BroadcastChannel('session-sync');
            ch.postMessage({ type: 'SESSION_EXTENDED', expiresAt: res.data.expiresAt });
            ch.close();
          } catch {
            // BroadcastChannel not available (SSR / old browser) — silently skip.
          }
        }
        return res.data.success === true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function forceLogout(): void {
  // Guard: only one logout in flight — multiple concurrent 401s must not each
  // fire a redirect. isLoggingOut resets on hard navigation (page reload).
  if (isLoggingOut) return;
  isLoggingOut = true;

  useAuthStore.getState().logout();

  // Clear server-side cookies (fire-and-forget).
  axios
    .post(
      `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/logout`,
      {},
      { withCredentials: true },
    )
    .catch(() => undefined);

  try {
    const ch = new BroadcastChannel('session-sync');
    ch.postMessage({ type: 'SESSION_EXPIRED' });
    ch.close();
  } catch {
    // ignore
  }

  // Hard redirect — resets all in-flight state including isLoggingOut.
  window.location.href = '/auth/login';
}

// Response interceptor: on 401, silently attempt one token refresh and retry
// the original request. If the refresh also fails, perform a full logout.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retried?: boolean };

    // Only intercept 401s on first attempt. Skip the refresh endpoint itself to
    // prevent an infinite loop when the refresh token is also expired.
    if (
      error.response?.status === 401 &&
      !originalRequest._retried &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/tenant-login') &&
      !originalRequest.url?.includes('/auth/register') &&
      !isLoggingOut
    ) {
      originalRequest._retried = true;

      const refreshed = await attemptRefresh();
      if (refreshed) {
        return apiClient(originalRequest);
      }

      forceLogout();
    }

    return Promise.reject(error as Error);
  },
);
