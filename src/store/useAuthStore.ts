import { create } from 'zustand';
import type { UserProfile } from '@/types/auth';
import { queryClient } from '@/lib/queryClient';

// Token is set as httpOnly cookie by the backend on login.
// Do not store in localStorage — any XSS script can read localStorage.
// The cookie is sent automatically by the browser on every request
// when withCredentials: true is set on the Axios instance.

const USER_KEY = 'auth-user';
const SESSION_EXPIRY_KEY = 'auth-session-expiry';

function loadUser(): UserProfile | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

function loadSessionExpiry(): number | null {
  const raw = localStorage.getItem(SESSION_EXPIRY_KEY);
  if (!raw) return null;
  const n = Number(raw);
  // Discard stale values — if the stored expiry is already past, treat as no expiry.
  return n > Date.now() ? n : null;
}

interface AuthState {
  user: UserProfile | null;
  // Token held in memory only — not persisted to localStorage.
  // Used as a fallback Authorization header in environments that do not
  // support cookies (e.g. React Native). The backend httpOnly cookie is
  // the primary auth mechanism.
  token: string | null;
  // Unix timestamp (ms) when the current access token expires.
  // Drives the session-expiry warning timer in useSessionTimer.
  sessionExpiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: UserProfile, token: string, expiresAt: number) => void;
  setSessionExpiry: (expiresAt: number) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  // Patches the signed-in user's own profile fields (e.g. after editing your
  // own display name elsewhere) without touching token/session state.
  updateProfile: (patch: Partial<UserProfile>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Rehydrate non-sensitive display data (name, email, roles) from localStorage.
  // Authentication state is determined by whether the httpOnly cookie is present,
  // but we cannot read httpOnly cookies from JS — we infer it from the persisted user profile.
  user: loadUser(),
  token: null, // never persisted; lives in memory only
  sessionExpiresAt: loadSessionExpiry(),
  isAuthenticated: Boolean(localStorage.getItem(USER_KEY)),
  isLoading: false,
  setAuth: (user, token, expiresAt) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));
    set({ user, token, sessionExpiresAt: expiresAt, isAuthenticated: true });
  },
  setSessionExpiry: (expiresAt) => {
    localStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));
    set({ sessionExpiresAt: expiresAt });
  },
  updateProfile: (patch) =>
    set((state) => {
      if (!state.user) return state;
      const user = { ...state.user, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { user };
    }),
  logout: () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    // Clear cached permission grants so a re-login always fetches fresh grants.
    queryClient.removeQueries({ queryKey: ['user-permissions'] });
    set({ user: null, token: null, sessionExpiresAt: null, isAuthenticated: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
}));
