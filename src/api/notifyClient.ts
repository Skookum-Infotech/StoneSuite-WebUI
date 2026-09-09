import axios, { type AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import { attemptRefresh } from './client';

// stonesuite-notify is a separate service (its own origin, its own deploy),
// not proxied through the main backend — so it needs its own axios instance
// with its own base URL. It validates the exact same JWT apiClient already
// carries (stonesuite-notify's JWT_SECRET is required to match this app's),
// so auth is just "attach the same in-memory token", not a new login flow.
//
// There is no cookie fallback here: a different origin never receives
// apiClient's httpOnly auth_token cookie, so the in-memory Bearer token is
// the ONLY credential this client has — and that token is null after every
// page reload until a backend call repopulates it. So a 401 here is almost
// always "the shared token isn't back yet", not a dead session. The response
// interceptor below does one silent refresh + retry for exactly that case.
// It reuses apiClient's attemptRefresh (a single shared in-flight promise),
// so it cannot race apiClient's own refresh.
export const notifyClient = axios.create({
  baseURL: import.meta.env.VITE_NOTIFY_BASE_URL || undefined,
  headers: { 'Content-Type': 'application/json' },
});

notifyClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On a 401, attempt one shared token refresh and retry the request once.
// Deliberately never forces a logout (unlike apiClient): the notification
// bell is a non-critical 60s-polled badge, and apiClient's own 401 handling
// on the next backend call is what actually ends a genuinely dead session.
notifyClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;

      const refreshed = await attemptRefresh();
      if (refreshed && useAuthStore.getState().token) {
        return notifyClient(originalRequest);
      }
    }

    return Promise.reject(error as Error);
  },
);
