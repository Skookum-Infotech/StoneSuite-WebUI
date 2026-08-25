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

// One workspace a customer-portal identity may sign into. Only present on a
// portal login/refresh response — a customer linked to several tenants
// (identity_tenants) gets the full list so the switcher can render without a
// second round-trip; a staff response never carries this.
export interface PortalWorkspace {
  tenantId: string;
  name: string;
  slug: string;
  active: boolean;
}

// The customer a portal session represents — fetched separately via
// GET /api/portal/me once the session is established, since neither the
// login nor refresh response carries it (see portal_profile.go's Me).
export interface PortalCustomer {
  id: string;
  name: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  // Unix ms timestamp when the access token expires.
  // Returned by login and refresh endpoints so the frontend can drive the session timer.
  expiresAt?: number;
  user?: UserProfile;
  // Present only when POST /api/auth/tenant-login resolved this identity as a
  // customer-portal login rather than a staff one (see controllers/tenant.go's
  // tryPortalLogin) — absent means staff, mirroring the backend JWT convention
  // where staff tokens carry no `kind` claim.
  kind?: 'portal';
  // The active workspace's tenant id. Only meaningful when kind is 'portal':
  // a customer session must resend this on every /portal/auth/refresh call,
  // since the expired access token can no longer be decoded to recover it.
  tenantId?: string;
  workspaces?: PortalWorkspace[];
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
