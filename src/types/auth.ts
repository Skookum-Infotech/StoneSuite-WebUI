export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  createdAt?: string;
  // Multi-tenant identity context (from /api/auth/tenant-login).
  tenantId?: string;
  isPlatformAdmin?: boolean;
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

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
}
