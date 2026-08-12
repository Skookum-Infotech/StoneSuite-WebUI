import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import { isHttpUrl, ssoConfigSchema, samlConfigSchema, ssoConfigErrorMessage } from './ssoConfigForm'

describe('isHttpUrl', () => {
  it.each([
    ['', true],
    ['https://login.example.com/callback', true],
    ['http://login.example.com', true],
    ['ftp://example.com', false],
    ['not-a-url', false],
    ['https://', false],
  ])('isHttpUrl(%p) -> %p', (input, expected) => {
    expect(isHttpUrl(input)).toBe(expected)
  })
})

describe('ssoConfigSchema', () => {
  const base = {
    provider: 'entra' as const,
    clientId: 'client-123',
    issuer: '',
    redirectUri: '',
    enabled: true,
  }

  it('requires a non-empty client secret on create', () => {
    const result = ssoConfigSchema(true).safeParse({ ...base, clientSecret: '' })
    expect(result.success).toBe(false)
  })

  it('allows an empty client secret on edit (keeps the existing secret)', () => {
    const result = ssoConfigSchema(false).safeParse({ ...base, clientSecret: '' })
    expect(result.success).toBe(true)
  })

  it('rejects a non-http(s) issuer URL', () => {
    const result = ssoConfigSchema(false).safeParse({ ...base, clientSecret: '', issuer: 'ftp://bad' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty client ID', () => {
    const result = ssoConfigSchema(false).safeParse({ ...base, clientId: '  ', clientSecret: '' })
    expect(result.success).toBe(false)
  })
})

describe('samlConfigSchema', () => {
  const base = { provider: 'entra' as const, enabled: true, defaultRoleId: '' }

  it.each([
    ['https://idp.example.com/metadata', true],
    ['http://idp.example.com/metadata', false], // must be https, not just http(s)
    ['', false],
    ['not-a-url', false],
    ['https://', false],
  ])('metadataUrl %p -> valid=%p', (metadataUrl, expected) => {
    const result = samlConfigSchema().safeParse({ ...base, metadataUrl })
    expect(result.success).toBe(expected)
  })

  it('accepts entra and cognito but rejects okta (backend samlProviders whitelist)', () => {
    const withProvider = (provider: string) =>
      samlConfigSchema().safeParse({
        provider,
        metadataUrl: 'https://idp.example.com/metadata',
        enabled: true,
        defaultRoleId: '',
      })
    expect(withProvider('entra').success).toBe(true)
    expect(withProvider('cognito').success).toBe(true)
    expect(withProvider('okta').success).toBe(false)
  })
})

describe('ssoConfigErrorMessage', () => {
  it('overrides 503 with an admin-contact message', () => {
    const err = new AxiosError('fail', undefined, undefined, undefined, {
      status: 503,
      data: { message: 'SSO configuration requires secret encryption to be enabled.' },
    } as never)
    expect(ssoConfigErrorMessage(err)).toBe(
      'SSO configuration is unavailable — contact your administrator to enable secret encryption.',
    )
  })

  it('overrides 502 with a metadata-fetch-failure message (saml only)', () => {
    const err = new AxiosError('fail', undefined, undefined, undefined, {
      status: 502,
      data: { message: 'Could not fetch or parse identity provider metadata: dial tcp: timeout' },
    } as never)
    expect(ssoConfigErrorMessage(err)).toBe(
      "Couldn't reach or parse that identity provider's metadata document. Double-check the URL and try again.",
    )
  })

  it('overrides 409 with a duplicate-provider message', () => {
    const err = new AxiosError('fail', undefined, undefined, undefined, {
      status: 409,
      data: { message: 'An SSO configuration for this provider already exists.' },
    } as never)
    expect(ssoConfigErrorMessage(err)).toBe('A configuration for this provider already exists.')
  })

  it('passes through the backend message for other errors', () => {
    const err = new AxiosError('fail', undefined, undefined, undefined, {
      status: 400,
      data: { message: 'metadata_url is required for protocol=saml.' },
    } as never)
    expect(ssoConfigErrorMessage(err)).toBe('metadata_url is required for protocol=saml.')
  })

  it('falls back for non-axios errors', () => {
    expect(ssoConfigErrorMessage(new Error('boom'))).toBe('boom')
    expect(ssoConfigErrorMessage('weird', 'fallback text')).toBe('fallback text')
  })
})
