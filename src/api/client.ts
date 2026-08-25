import axios, { type AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  // Send httpOnly cookies (auth_token + refresh_token) automatically on every request.
  withCredentials: true,
});

// Reads a cookie by name. Only useful for non-httpOnly cookies — csrf_token
// is deliberately not httpOnly so this can read it (see backend
// middleware/csrf.go for why the header must echo the cookie's value).
function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Request interceptor: attach Authorization header as a fallback for environments
// that do not support cookies (e.g. React Native, some CORS configurations),
// and echo the csrf_token cookie back as a header (double-submit CSRF check —
// a no-op on the backend unless it's running with SameSite=None cookies).
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const csrfToken = readCookie('csrf_token');
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
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
        const { kind, activeTenantId } = useAuthStore.getState();
        // A customer-portal session refreshes at a different endpoint and
        // must resend the active workspace's tenantId: the access token is
        // already expired by the time refresh runs, so the server has
        // nothing else to recover which workspace to resume (see
        // controllers/portal_auth.go's Refresh). Omitting it would silently
        // resume the customer's first linked workspace instead of the one
        // they were actually using.
        if (kind === 'portal') {
          if (!activeTenantId) return false;
          const res = await apiClient.post<{
            success: boolean; token?: string; expiresAt?: number; tenantId?: string;
          }>('/portal/auth/refresh', { tenantId: activeTenantId });
          if (res.data.success && res.data.token && res.data.expiresAt) {
            useAuthStore.getState().applyWorkspaceSwitch(
              res.data.tenantId ?? activeTenantId,
              res.data.token,
              res.data.expiresAt,
            );
            broadcastSessionExtended(res.data.expiresAt);
          }
          return res.data.success === true;
        }

        // Goes through apiClient so the request interceptor still attaches the
        // Authorization fallback and X-CSRF-Token. Safe from recursion: the
        // response interceptor below skips 401 handling for /auth/refresh.
        const res = await apiClient.post<{ success: boolean; token?: string; expiresAt?: number }>(
          '/auth/refresh',
        );
        if (res.data.success && res.data.expiresAt) {
          useAuthStore.getState().setSessionExpiry(res.data.expiresAt);
          broadcastSessionExtended(res.data.expiresAt);
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

// Broadcasts the new expiry to all other tabs. Shared by both the staff and
// portal refresh branches above — one channel, since the two client instances
// were merged into one (see CLAUDE.md's merged-login design).
function broadcastSessionExtended(expiresAt: number): void {
  try {
    const ch = new BroadcastChannel('session-sync');
    ch.postMessage({ type: 'SESSION_EXTENDED', expiresAt });
    ch.close();
  } catch {
    // BroadcastChannel not available (SSR / old browser) — silently skip.
  }
}

function forceLogout(): void {
  // Guard: only one logout in flight — multiple concurrent 401s must not each
  // fire a redirect. isLoggingOut resets on hard navigation (page reload).
  if (isLoggingOut) return;
  isLoggingOut = true;

  // Read before logout() clears it — a customer session's server-side
  // cookies live at /api/portal/auth/logout, not /api/auth/logout, and
  // RequireAuth's path confinement would 403 (not clear anything) if a
  // portal-kind token hit the staff endpoint instead.
  const wasPortal = useAuthStore.getState().kind === 'portal';
  useAuthStore.getState().logout();

  // Clear server-side cookies (fire-and-forget). Uses apiClient so the request
  // still carries X-CSRF-Token; isLoggingOut above stops the response
  // interceptor from reacting to a 401 on this call.
  apiClient.post(wasPortal ? '/portal/auth/logout' : '/auth/logout').catch(() => undefined);

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

    // Only intercept 401s on first attempt. Skip both refresh endpoints
    // themselves to prevent an infinite loop when the refresh token is also
    // expired — /portal/auth/refresh is the customer-session equivalent of
    // /auth/refresh, used when useAuthStore's kind is 'portal'.
    if (
      error.response?.status === 401 &&
      !originalRequest._retried &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/portal/auth/refresh') &&
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
