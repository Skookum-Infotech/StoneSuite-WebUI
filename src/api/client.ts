import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

// Token is set as httpOnly cookie by the backend on login.
// Do not store in localStorage — any XSS script can read localStorage.
// withCredentials: true ensures the cookie is sent automatically on every request.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // send httpOnly cookies automatically
});

// Request interceptor: attach Authorization header as a fallback for environments
// that do not support cookies (e.g. React Native, some CORS configurations).
// The token is read from the Zustand store (in-memory only — never localStorage).
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
