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
  },

  // Request a password-reset email for the given address.
  forgotPassword: async (email: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  // Validate a password-reset token before showing the new-password form.
  validateResetToken: async (token: string): Promise<{ success: boolean; valid: boolean; email: string }> => {
    const response = await apiClient.get(`/auth/reset-password/${token}`);
    return response.data;
  },

  // Complete the reset — exchange the token for a new password.
  resetPassword: async (token: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },
};
