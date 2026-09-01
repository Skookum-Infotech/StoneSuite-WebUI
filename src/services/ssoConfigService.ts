import { tenantClient } from '@/api/tenantClient';
import type { SSOConfig, SSOConfigCreatePayload, SSOConfigUpdatePayload, SSOProvider } from '@/types/tenant';

// SSO provider configuration — /api/tenant/sso-configs*. protocol="oidc" is
// configuration only (no login flow); protocol="saml" is fully wired end to
// end (see samlAuthService for the login-flow calls).
const BASE = '/tenant/sso-configs';

// The control-plane response mirrors DB columns directly (snake_case JSON
// tags), unlike every other tenant-plane endpoint in this app. Normalize to
// camelCase here so nothing outside this file has to know that. All saml
// fields are omitempty on the wire (absent for oidc configs) and vice versa.
interface SSOConfigWire {
  id: string;
  tenant_id: string;
  provider: string;
  protocol?: 'oidc' | 'saml'; // absent means "oidc", matching the backend's DB default
  client_id?: string;
  issuer?: string;
  redirect_uri?: string;
  metadata_url?: string;
  idp_entity_id?: string;
  sso_url?: string;
  slo_url?: string;
  certificate_fingerprint?: string;
  name_id_format?: string;
  metadata_fetched_at?: string;
  default_role_id?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

function mapSSOConfig(w: SSOConfigWire): SSOConfig {
  const base = {
    id: w.id,
    tenantId: w.tenant_id,
    enabled: w.enabled,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
  if (w.protocol === 'saml') {
    return {
      ...base,
      protocol: 'saml',
      provider: w.provider,
      metadataUrl: w.metadata_url ?? '',
      idpEntityId: w.idp_entity_id ?? '',
      ssoUrl: w.sso_url ?? '',
      sloUrl: w.slo_url ?? '',
      certificateFingerprint: w.certificate_fingerprint ?? '',
      nameIdFormat: w.name_id_format ?? '',
      metadataFetchedAt: w.metadata_fetched_at ?? null,
      defaultRoleId: w.default_role_id ?? '',
    };
  }
  return {
    ...base,
    protocol: 'oidc',
    provider: w.provider as SSOProvider,
    clientId: w.client_id ?? '',
    issuer: w.issuer ?? '',
    redirectUri: w.redirect_uri ?? '',
  };
}

function toWirePayload(payload: SSOConfigCreatePayload | SSOConfigUpdatePayload) {
  if (payload.protocol === 'saml') {
    return {
      provider: payload.provider,
      protocol: 'saml',
      metadata_url: payload.metadataUrl,
      enabled: payload.enabled,
      default_role_id: payload.defaultRoleId ?? '',
    };
  }
  return {
    provider: payload.provider,
    protocol: 'oidc',
    client_id: payload.clientId,
    client_secret: payload.clientSecret ?? '',
    issuer: payload.issuer ?? '',
    redirect_uri: payload.redirectUri ?? '',
    enabled: payload.enabled,
  };
}

export const ssoConfigService = {
  list: (): Promise<SSOConfig[]> =>
    tenantClient
      .get<{ success: boolean; sso_configs: SSOConfigWire[] }>(BASE)
      .then((r) => (r.data.sso_configs ?? []).map(mapSSOConfig)),

  get: (id: string): Promise<SSOConfig> =>
    tenantClient
      .get<{ success: boolean; sso_config: SSOConfigWire }>(`${BASE}/${id}`)
      .then((r) => mapSSOConfig(r.data.sso_config)),

  create: (payload: SSOConfigCreatePayload): Promise<SSOConfig> =>
    tenantClient
      .post<{ success: boolean; sso_config: SSOConfigWire }>(BASE, toWirePayload(payload))
      .then((r) => mapSSOConfig(r.data.sso_config)),

  // For oidc, clientSecret omitted (or blank) keeps the stored secret — the
  // server only re-encrypts when a non-empty value is sent. For saml,
  // metadata_url is always re-fetched server-side regardless.
  update: (id: string, payload: SSOConfigUpdatePayload): Promise<SSOConfig> =>
    tenantClient
      .put<{ success: boolean; sso_config: SSOConfigWire }>(`${BASE}/${id}`, toWirePayload(payload))
      .then((r) => mapSSOConfig(r.data.sso_config)),

  // saml only — re-fetches the stored metadata_url and updates the derived
  // IdP fields + certificate in place. 400 if the target isn't protocol=saml.
  refreshMetadata: (id: string): Promise<SSOConfig> =>
    tenantClient
      .post<{ success: boolean; sso_config: SSOConfigWire }>(`${BASE}/${id}/refresh-metadata`)
      .then((r) => mapSSOConfig(r.data.sso_config)),

  remove: (id: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${id}`).then(() => undefined),
};
