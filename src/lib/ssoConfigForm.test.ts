import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import { isHttpUrl, ssoConfigSchema, ssoConfigErrorMessage } from './ssoConfigForm'

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

  it('passes through the backend message for other errors', () => {
    const err = new AxiosError('fail', undefined, undefined, undefined, {
      status: 409,
      data: { message: 'An SSO configuration for this provider already exists.' },
    } as never)
    expect(ssoConfigErrorMessage(err)).toBe('An SSO configuration for this provider already exists.')
  })

  it('falls back for non-axios errors', () => {
    expect(ssoConfigErrorMessage(new Error('boom'))).toBe('boom')
    expect(ssoConfigErrorMessage('weird', 'fallback text')).toBe('fallback text')
  })
})
