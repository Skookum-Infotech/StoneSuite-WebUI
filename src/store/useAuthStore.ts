import { create } from 'zustand';
import type { UserProfile } from '@/types/auth';

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
  user: null,
  token: localStorage.getItem('auth-token'),
  isAuthenticated: !!localStorage.getItem('auth-token'),
  isLoading: true, // Start true so we can verify token on initial load
  setAuth: (user, token) => {
    localStorage.setItem('auth-token', token);
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('auth-token');
    set({ user: null, token: null, isAuthenticated: false });
  },
  setLoading: (isLoading) => set({ isLoading }),
}));
