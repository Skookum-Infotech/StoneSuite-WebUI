import type { SAMLProvider } from './tenant';

export interface UserRole {
  id: string;
  name: string;
  key: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  createdAt?: string;
  // Multi-tenant identity context (from /api/auth/tenant-login).
  tenantId?: string;
  isPlatformAdmin?: boolean;
  roles?: UserRole[];
  selectedRoleId?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  // Unix ms timestamp when the access token expires.
  // Returned by login and refresh endpoints so the frontend can drive the session timer.
  expiresAt?: number;
  user?: UserProfile;
}

export interface RefreshResponse {
  success: boolean;
  token?: string;
  expiresAt?: number;
  message?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Result of POST /api/auth/identify -- tells the login page's email step
// whether to show the password field or redirect to an identity provider.
// A function of the email's domain only, never of whether an account
// exists (see authService.identify).
export type IdentifyResult =
  | { method: 'password' }
  | { method: 'sso'; provider: SAMLProvider; tenantId: string };

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
}
