import { tenantClient } from '@/api/tenantClient';
import type { SSOConfig, SSOConfigCreatePayload, SSOConfigUpdatePayload } from '@/types/tenant';

// SSO provider configuration — /api/tenant/sso-configs*. Configuration only;
// the OAuth login flow (authorize/callback/token exchange) does not exist yet.
const BASE = '/tenant/sso-configs';

// The control-plane response mirrors DB columns directly (snake_case JSON
// tags), unlike every other tenant-plane endpoint in this app. Normalize to
// camelCase here so nothing outside this file has to know that.
interface SSOConfigWire {
  id: string;
  tenant_id: string;
  provider: string;
  client_id: string;
  issuer: string;
  redirect_uri: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

function mapSSOConfig(w: SSOConfigWire): SSOConfig {
  return {
    id: w.id,
    tenantId: w.tenant_id,
    provider: w.provider as SSOConfig['provider'],
    clientId: w.client_id,
    issuer: w.issuer,
    redirectUri: w.redirect_uri,
    enabled: w.enabled,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export const ssoConfigService = {
  list: (): Promise<SSOConfig[]> =>
    tenantClient
      .get<{ success: boolean; sso_configs: SSOConfigWire[] }>(BASE)
      .then((r) => (r.data.sso_configs ?? []).map(mapSSOConfig)),

  create: (payload: SSOConfigCreatePayload): Promise<SSOConfig> =>
    tenantClient
      .post<{ success: boolean; sso_config: SSOConfigWire }>(BASE, {
        provider: payload.provider,
        client_id: payload.clientId,
        client_secret: payload.clientSecret,
        issuer: payload.issuer ?? '',
        redirect_uri: payload.redirectUri ?? '',
        enabled: payload.enabled,
      })
      .then((r) => mapSSOConfig(r.data.sso_config)),

  // clientSecret omitted (or blank) keeps the stored secret — the server only
  // re-encrypts when a non-empty value is sent.
  update: (id: string, payload: SSOConfigUpdatePayload): Promise<SSOConfig> =>
    tenantClient
      .put<{ success: boolean; sso_config: SSOConfigWire }>(`${BASE}/${id}`, {
        provider: payload.provider,
        client_id: payload.clientId,
        client_secret: payload.clientSecret ?? '',
        issuer: payload.issuer ?? '',
        redirect_uri: payload.redirectUri ?? '',
        enabled: payload.enabled,
      })
      .then((r) => mapSSOConfig(r.data.sso_config)),

  remove: (id: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${id}`).then(() => undefined),
};
