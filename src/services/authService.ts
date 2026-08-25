import { apiClient } from '@/api/client';
import { isPortalSession } from '@/store/useAuthStore';
import type {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  RefreshResponse,
  UserProfile,
  IdentifyResult,
  PortalWorkspace,
} from '@/types/auth';
import type { SAMLProvider } from '@/types/tenant';

interface IdentifyWire {
  success: boolean;
  method: 'password' | 'sso';
  provider?: string;
  tenant_id?: string;
}

export const authService = {
  // Login page's first step: resolves an email to "password" (show the
  // password field) or "sso" (redirect to that provider). Always call this
  // before showing a password field -- never assume "password" for an email
  // that hasn't been through it, since a domain can be SSO-only.
  identify: async (email: string): Promise<IdentifyResult> => {
    const response = await apiClient.post<IdentifyWire>('/auth/identify', { email });
    const { method, provider, tenant_id } = response.data;
    if (method === 'sso' && provider && tenant_id) {
      return { method: 'sso', provider: provider as SAMLProvider, tenantId: tenant_id };
    }
    return { method: 'password' };
  },

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

  // Exchange the refresh_token httpOnly cookie for a new access token.
  // Called by useSessionTimer ("Stay") and by the Axios 401 interceptor.
  refreshSession: async (): Promise<RefreshResponse> => {
    const response = await apiClient.post<RefreshResponse>('/auth/refresh');
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

  // Change password while authenticated (requires current password for verification).
  // A customer-portal session changes its password at a different endpoint
  // (see CLAUDE.md's merged-login design) — /auth/change-password requires a
  // `users` row, which a portal identity never has, and a portal-kind token
  // is structurally confined away from it regardless (RequireAuth).
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const path = isPortalSession() ? '/portal/auth/change-password' : '/auth/change-password';
    const response = await apiClient.post(path, { currentPassword, newPassword });
    return response.data;
  },

  // Lists the workspaces the caller may switch between. setPortalAuth carries
  // this at login, but it lives in memory only (see useAuthStore) — a hard
  // refresh wipes it, so MainLayout re-fetches it on mount for a portal
  // session to repopulate the profile menu's workspace list.
  workspaces: async (): Promise<{ success: boolean; workspaces: PortalWorkspace[] }> => {
    const response = await apiClient.get('/portal/workspaces');
    return response.data;
  },

  // Re-mints a customer-portal session against a different linked workspace
  // (see identity_tenants) — the only session kind with this concept; a
  // staff identity belongs to exactly one workspace.
  switchWorkspace: async (
    tenantId: string,
  ): Promise<{ success: boolean; token: string; expiresAt: number; tenantId: string; workspaceName: string }> => {
    const response = await apiClient.post('/portal/auth/switch-workspace', { tenantId });
    return response.data;
  },

  // The customer-portal counterpart of userService.getUserInvite/
  // acceptUserInvite — a separate token namespace (portal_invites, not
  // user_invites), so AcceptInvitePage tries the staff lookup first and
  // falls back to this pair on a 404. Validates without consuming.
  getPortalInvite: async (
    token: string,
  ): Promise<{ email: string; fullName: string; workspaceName: string; expiresAt: string }> => {
    const response = await apiClient.get(`/portal/auth/invite/${token}`);
    return response.data;
  },

  // No fullName field: unlike a staff invite, a portal customer's name was
  // already set by the staff member who granted access (see
  // PortalAccessOps.CreatePortalUser) — accepting only sets the password.
  acceptPortalInvite: async (token: string, password: string): Promise<{ success: boolean }> => {
    const response = await apiClient.post('/portal/auth/accept-invite', { token, password });
    return response.data;
  },
};
