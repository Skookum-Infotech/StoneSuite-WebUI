import axios, { isAxiosError, type AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

/** Base URL every API call goes to — shared by apiClient and by `fetch`-based
 *  callers that can't go through axios (aiService's streaming ask). */
export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // Send httpOnly cookies (auth_token + refresh_token) automatically on every request.
  withCredentials: true,
});

// Reads a cookie by name. Only useful for non-httpOnly cookies — csrf_token
// is deliberately not httpOnly so this can read it (see backend
// middleware/csrf.go for why the header must echo the cookie's value).
// Exported so a `fetch`-based caller that bypasses apiClient entirely (e.g.
// aiService's streaming ask, which axios's buffering XHR adapter can't do)
// can still echo the same CSRF header without reimplementing cookie parsing.
export function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Request interceptor: attach Authorization header as a fallback for environments
// that do not support cookies (e.g. React Native, some CORS configurations),
// and echo the csrf_token cookie back as a header (double-submit CSRF check —
// a no-op on the backend unless it's running with SameSite=None cookies).
/** The Authorization fallback and CSRF echo every request carries — the same
 *  headers for apiClient's interceptor and for `fetch`-based callers. */
export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = useAuthStore.getState().token;
  if (token) headers.Authorization = `Bearer ${token}`;
  const csrfToken = readCookie('csrf_token');
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  return headers;
}

apiClient.interceptors.request.use((config) => {
  for (const [name, value] of Object.entries(authHeaders())) {
    config.headers[name] = value;
  }
  return config;
});

// Track whether a token refresh is already in flight so concurrent 401s
// don't each spawn a separate refresh request.
let refreshPromise: Promise<RefreshOutcome> | null = null;

/** How a refresh attempt ended. Only `rejected` means the server said the
 *  session is over; `transient` means we could not find out (network error,
 *  timeout, 5xx — e.g. a Fly/Neon cold start) and the session may be fine. */
export type RefreshOutcome = 'ok' | 'rejected' | 'transient';

// Waits between retries of a transient refresh failure. Sized to outlast a
// scale-to-zero cold start (~1-2s) so a reload that lands on a stopped backend
// recovers instead of logging the user out.
const TRANSIENT_RETRY_DELAYS_MS = [1000, 2000, 4000];

/** True when a failed refresh call is the server definitively refusing the
 *  session (401/403 or another non-retryable 4xx), as opposed to a failure to
 *  reach or complete the request. */
export function isRefreshRejection(err: unknown): boolean {
  if (!isAxiosError(err) || !err.response) return false;
  const { status } = err.response;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

// Track whether a logout is already in progress so multiple concurrent 401s
// each hitting the logout path don't each fire window.location redirects.
let isLoggingOut = false;

// Exported so notifyClient can reuse the exact same refresh (one shared
// in-flight promise via refreshPromise) instead of racing it with a second
// /auth/refresh of its own. Retries transient failures before giving up, so a
// `transient` result means the backend stayed unreachable for the whole window.
export async function attemptRefresh(): Promise<RefreshOutcome> {
  // Only one refresh at a time — share the promise across concurrent callers.
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        let outcome = await refreshOnce();
        for (const delay of TRANSIENT_RETRY_DELAYS_MS) {
          if (outcome !== 'transient') break;
          await new Promise((resolve) => setTimeout(resolve, delay));
          outcome = await refreshOnce();
        }
        return outcome;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

// A single refresh request, classified into a RefreshOutcome.
async function refreshOnce(): Promise<RefreshOutcome> {
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
      if (!activeTenantId) return 'rejected';
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
      return res.data.success === true ? 'ok' : 'rejected';
    }

    // Goes through apiClient so the request interceptor still attaches the
    // Authorization fallback and X-CSRF-Token. Safe from recursion: the
    // response interceptor below skips 401 handling for /auth/refresh.
    //
    // Re-sends the caller's selected role (if any) so a silent refresh
    // doesn't quietly widen an intentionally-narrowed session back to
    // the full aggregate of every role held — RefreshSession otherwise
    // has no way to know a role was ever selected, since the old token
    // isn't decoded client-side. selectedRoleId is the right source: set
    // on login, updated on every switch-role, and persisted across a
    // reload (unlike the in-memory token itself).
    const { user } = useAuthStore.getState();
    const res = await apiClient.post<{ success: boolean; token?: string; expiresAt?: number }>(
      '/auth/refresh',
      user?.selectedRoleId ? { activeRoleId: user.selectedRoleId } : undefined,
    );
    if (res.data.success && res.data.expiresAt) {
      // /auth/refresh re-issues the access token (RefreshSession returns
      // it in the body). Store it, not just the expiry — cross-origin
      // clients (notifyClient) have no cookie to fall back on and would
      // otherwise stay unauthenticated until the next full login.
      if (res.data.token) {
        useAuthStore.getState().setSession(res.data.token, res.data.expiresAt);
      } else {
        useAuthStore.getState().setSessionExpiry(res.data.expiresAt);
      }
      broadcastSessionExtended(res.data.expiresAt);
    }
    return res.data.success === true ? 'ok' : 'rejected';
  } catch (err) {
    // Only an explicit refusal ends the session. A network error, timeout or
    // 5xx says nothing about the refresh token, so it must not log anyone out.
    return isRefreshRejection(err) ? 'rejected' : 'transient';
  }
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

// Exported so a `fetch`-based caller (aiService's stream) whose 401 survives a
// refresh ends the session exactly the way apiClient does.
export function forceLogout(): void {
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

      const outcome = await attemptRefresh();
      if (outcome === 'ok') {
        return apiClient(originalRequest);
      }

      // Log out only when the server refused the refresh. If it could not be
      // reached (outcome 'transient'), the session may still be valid — fail
      // this one request and leave the user signed in to retry.
      if (outcome === 'rejected') forceLogout();
    }

    return Promise.reject(error as Error);
  },
);
