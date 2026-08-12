import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import { tenantClient } from '@/api/tenantClient'
import { ssoConfigService } from './ssoConfigService'

describe('ssoConfigService — protocol=saml mapping', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps a saml wire config to camelCase, including server-derived IdP fields', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true,
        sso_configs: [
          {
            id: '1',
            tenant_id: 't1',
            provider: 'entra',
            protocol: 'saml',
            metadata_url: 'https://idp.example.com/metadata',
            idp_entity_id: 'https://idp.example.com/entity',
            sso_url: 'https://idp.example.com/sso',
            slo_url: 'https://idp.example.com/slo',
            certificate_fingerprint: 'AA:BB:CC',
            name_id_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            metadata_fetched_at: '2026-08-01T00:00:00Z',
            enabled: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
      },
    })

    const configs = await ssoConfigService.list()

    expect(configs).toHaveLength(1)
    expect(configs[0]).toMatchObject({
      id: '1',
      protocol: 'saml',
      provider: 'entra',
      metadataUrl: 'https://idp.example.com/metadata',
      idpEntityId: 'https://idp.example.com/entity',
      ssoUrl: 'https://idp.example.com/sso',
      sloUrl: 'https://idp.example.com/slo',
      certificateFingerprint: 'AA:BB:CC',
      metadataFetchedAt: '2026-08-01T00:00:00Z',
    })
    // oidc-only fields must never leak onto a saml config's shape.
    expect(configs[0]).not.toHaveProperty('clientId')
  })

  it('defaults protocol to oidc when absent from the wire response (backend DB default)', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: {
        success: true,
        sso_configs: [
          {
            id: '2',
            tenant_id: 't1',
            provider: 'okta',
            client_id: 'abc',
            enabled: false,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      },
    })

    const configs = await ssoConfigService.list()

    expect(configs[0]).toMatchObject({ protocol: 'oidc', provider: 'okta', clientId: 'abc' })
  })

  it('create sends only saml-relevant fields, omitting client_id/client_secret entirely', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({
      data: {
        success: true,
        sso_config: {
          id: '3',
          tenant_id: 't1',
          provider: 'cognito',
          protocol: 'saml',
          metadata_url: 'https://idp.example.com/metadata',
          enabled: false,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      },
    })

    await ssoConfigService.create({
      protocol: 'saml',
      provider: 'cognito',
      metadataUrl: 'https://idp.example.com/metadata',
      enabled: false,
    })

    expect(tenantClient.post).toHaveBeenCalledWith('/tenant/sso-configs', {
      provider: 'cognito',
      protocol: 'saml',
      metadata_url: 'https://idp.example.com/metadata',
      enabled: false,
    })
  })

  it('refreshMetadata posts to the refresh-metadata sub-route with no body', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({
      data: {
        success: true,
        sso_config: {
          id: '4',
          tenant_id: 't1',
          provider: 'entra',
          protocol: 'saml',
          metadata_url: 'https://idp.example.com/metadata',
          enabled: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      },
    })

    const result = await ssoConfigService.refreshMetadata('4')

    expect(tenantClient.post).toHaveBeenCalledWith('/tenant/sso-configs/4/refresh-metadata')
    expect(result.protocol).toBe('saml')
  })
})
