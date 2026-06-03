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
  user?: UserProfile;
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
