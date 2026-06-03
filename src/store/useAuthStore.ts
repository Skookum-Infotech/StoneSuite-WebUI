import { create } from 'zustand';
import type { UserProfile } from '@/types/auth';

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
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: UserProfile, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Rehydrate from localStorage so the tenant context + platform-admin flag
  // survive a page reload (no /me round-trip needed for the tenant identity).
  user: loadUser(),
  token: localStorage.getItem('auth-token'),
  isAuthenticated: Boolean(localStorage.getItem('auth-token')),
  isLoading: false,
  setAuth: (user, token) => {
    localStorage.setItem('auth-token', token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('auth-token');
    localStorage.removeItem(USER_KEY);
    set({ user: null, token: null, isAuthenticated: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
}));
