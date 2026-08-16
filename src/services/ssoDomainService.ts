import { tenantClient } from '@/api/tenantClient';
import type { SSODomain } from '@/types/tenant';

// Email domains registered against a SAML config for home-realm discovery —
// /api/tenant/sso-configs/{id}/domains*.
function base(ssoConfigId: string) {
  return `/tenant/sso-configs/${ssoConfigId}/domains`;
}

interface SSODomainWire {
  id: string;
  sso_config_id: string;
  domain: string;
  created_at: string;
}

function mapSSODomain(w: SSODomainWire): SSODomain {
  return { id: w.id, ssoConfigId: w.sso_config_id, domain: w.domain, createdAt: w.created_at };
}

export const ssoDomainService = {
  list: (ssoConfigId: string): Promise<SSODomain[]> =>
    tenantClient
      .get<{ success: boolean; domains: SSODomainWire[] }>(base(ssoConfigId))
      .then((r) => (r.data.domains ?? []).map(mapSSODomain)),

  create: (ssoConfigId: string, domain: string): Promise<SSODomain> =>
    tenantClient
      .post<{ success: boolean; domain: SSODomainWire }>(base(ssoConfigId), { domain })
      .then((r) => mapSSODomain(r.data.domain)),

  remove: (ssoConfigId: string, domainId: string): Promise<void> =>
    tenantClient.delete(`${base(ssoConfigId)}/${domainId}`).then(() => undefined),
};
