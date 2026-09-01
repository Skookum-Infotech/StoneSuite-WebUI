import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

// stonesuite-notify is a separate service (its own origin, its own deploy),
// not proxied through the main backend — so it needs its own axios instance
// with its own base URL. It validates the exact same JWT apiClient already
// carries (stonesuite-notify's JWT_SECRET is required to match this app's),
// so auth is just "attach the same in-memory token", not a new login flow.
// No cookies here (a different origin wouldn't receive apiClient's httpOnly
// cookies anyway) and no refresh-on-401 handling: a stray 401 here just
// fails this one poll/action silently — apiClient's own refresh flow (driven
// by calls to the main backend) is what actually keeps the shared token
// alive, so duplicating that logic would just race it.
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
