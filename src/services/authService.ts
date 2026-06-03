import { apiClient } from '@/api/client';
import type { LoginCredentials, RegisterData, AuthResponse, UserProfile } from '@/types/auth';

export const authService = {
  // Authenticate against the multi-tenant control plane. The response carries
  // the user's tenant context + platform-admin flag, used to gate owner-only UI.
  login: async (data: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/tenant-login', data);
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
