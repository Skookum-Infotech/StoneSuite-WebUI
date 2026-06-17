import { create } from 'zustand';
import type { UserProfile } from '@/types/auth';

// Token is set as httpOnly cookie by the backend on login.
// Do not store in localStorage — any XSS script can read localStorage.
// The cookie is sent automatically by the browser on every request
// when withCredentials: true is set on the Axios instance.

const USER_KEY = 'auth-user';

function loadUser(): UserProfile | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

interface AuthState {
  user: UserProfile | null;
  // Token held in memory only — not persisted to localStorage.
  // Used as a fallback Authorization header in environments that do not
  // support cookies (e.g. React Native). The backend httpOnly cookie is
  // the primary auth mechanism.
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: UserProfile, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Rehydrate non-sensitive display data (name, email, roles) from localStorage.
  // Authentication state is determined by whether the httpOnly cookie is present,
  // but we cannot read httpOnly cookies from JS — we infer it from the persisted user profile.
  user: loadUser(),
  token: null, // never persisted; lives in memory only
  isAuthenticated: Boolean(localStorage.getItem(USER_KEY)),
  isLoading: false,
  setAuth: (user, token) => {
    // Persist only non-sensitive display data, not the token
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem(USER_KEY);
    set({ user: null, token: null, isAuthenticated: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
}));
