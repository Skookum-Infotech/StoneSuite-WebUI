import { apiClient } from '@/api/client';
import type { AuthResponse } from '@/types/auth';
import type { SAMLProvider } from '@/types/tenant';

// SAML login flow — /api/auth/saml/*. Distinct from ssoConfigService, which
// only manages configuration CRUD. These routes are public/pre-session (the
// tenant isn't resolved yet), so they go through the base apiClient, not
// tenantClient.
const AUTH_BASE = '/auth/saml';

export interface SamlSpInfo {
  provider: SAMLProvider;
  spEntityId: string;
  acsUrl: string;
  sloUrl: string;
}

interface SamlSpInfoWire {
  success: boolean;
  provider: string;
  sp_entity_id: string;
  acs_url: string;
  slo_url: string;
}

export interface SamlLogoutResult {
  sloAvailable: boolean;
  logoutUrl?: string;
}

interface SamlLogoutWire {
  success: boolean;
  slo_available: boolean;
  logout_url?: string;
}

interface InitiateUrlOptions {
  tenantId?: string;
  tenantSlug?: string;
  returnTo?: string;
}

export const samlAuthService = {
  // Public, no DB call — the same SP values embedded in the metadata XML.
  spInfo: (provider: SAMLProvider): Promise<SamlSpInfo> =>
    apiClient.get<SamlSpInfoWire>(`${AUTH_BASE}/${provider}/sp-info`).then((r) => ({
      provider: r.data.provider as SAMLProvider,
      spEntityId: r.data.sp_entity_id,
      acsUrl: r.data.acs_url,
      sloUrl: r.data.slo_url,
    })),

  // Trades the ACS-minted one-time code for a real session. Response shape
  // is identical to authService.login's (see saml_exchange.go).
  exchange: (code: string): Promise<AuthResponse> =>
    apiClient.post<AuthResponse>(`${AUTH_BASE}/exchange`, { code }).then((r) => r.data),

  // Requires an existing session (JWT). Local auth cookies are always
  // cleared server-side before this resolves, regardless of sloAvailable.
  logout: (provider: SAMLProvider): Promise<SamlLogoutResult> =>
    apiClient.post<SamlLogoutWire>(`${AUTH_BASE}/${provider}/logout`).then((r) => ({
      sloAvailable: r.data.slo_available,
      logoutUrl: r.data.logout_url,
    })),

  // Pure string builder for a full-page redirect — GET /initiate is a 302,
  // never call this via axios. Callers do
  // `window.location.href = samlAuthService.initiateUrl(...)`.
  initiateUrl: (provider: SAMLProvider, opts: InitiateUrlOptions): string => {
    const hasId = Boolean(opts.tenantId);
    const hasSlug = Boolean(opts.tenantSlug);
    if (hasId === hasSlug) {
      throw new Error('initiateUrl requires exactly one of tenantId or tenantSlug');
    }
    const base = (apiClient.defaults.baseURL ?? '/api').replace(/\/$/, '');
    const params = new URLSearchParams();
    if (opts.tenantId) params.set('tenant_id', opts.tenantId);
    if (opts.tenantSlug) params.set('tenant_slug', opts.tenantSlug);
    if (opts.returnTo) params.set('return_to', opts.returnTo);
    return `${base}${AUTH_BASE}/${provider}/initiate?${params.toString()}`;
  },
};
