import { apiClient } from '@/api/client';
import type { LoginCredentials, RegisterData, AuthResponse, UserProfile } from '@/types/auth';

export const authService = {
  login: async (data: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },
  
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  },
  
  getCurrentUser: async (): Promise<{ success: boolean; user: UserProfile }> => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  }
};
