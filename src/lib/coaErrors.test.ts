import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import { parseCoaError } from './coaErrors'

function makeError(status: number, data: unknown) {
  return new AxiosError('Request failed', String(status), undefined, undefined, {
    status,
    data,
  } as never)
}

describe('parseCoaError', () => {
  it('classifies a 503 as encryptionUnavailable', () => {
    const info = parseCoaError(makeError(503, {
      message: 'Bank account details cannot be saved: secret encryption is not configured.',
    }))
    expect(info.kind).toBe('encryptionUnavailable')
    expect(info.message).toContain('secret encryption is not configured')
  })

  it('classifies a 400 as validation', () => {
    const info = parseCoaError(makeError(400, { message: 'Attribute "foo" is not valid for a "cash" account.' }))
    expect(info.kind).toBe('validation')
  })

  it('classifies a 409 with non-empty blockingSlots as blockingSlots, carrying the slot keys', () => {
    const info = parseCoaError(makeError(409, {
      message: 'Account 1103 Bank is in use as a default account (default_bank). Point the default at another account first.',
      blockingSlots: ['default_bank'],
    }))
    expect(info.kind).toBe('blockingSlots')
    expect(info.blockingSlots).toEqual(['default_bank'])
  })

  it('classifies a 409 with null blockingSlots and the version-conflict message as versionConflict', () => {
    const info = parseCoaError(makeError(409, {
      message: 'This account was changed by someone else. Reload and try again.',
      blockingSlots: null,
    }))
    expect(info.kind).toBe('versionConflict')
    expect(info.blockingSlots).toBeUndefined()
  })

  it('classifies a 409 with no blockingSlots and no version-conflict message as a plain conflict', () => {
    const info = parseCoaError(makeError(409, {
      message: 'Account 1103 Bank is a header account and cannot be used as a default.',
      blockingSlots: null,
    }))
    expect(info.kind).toBe('conflict')
  })

  it('classifies a 404 as generic', () => {
    expect(parseCoaError(makeError(404, { message: 'Account not found.' })).kind).toBe('generic')
  })

  it('falls back to the provided message for a non-axios error', () => {
    const info = parseCoaError(new Error('boom'), 'fallback')
    expect(info.kind).toBe('generic')
    expect(info.message).toBe('boom')
  })

  it('uses the fallback for a non-Error, non-axios value', () => {
    expect(parseCoaError('oops', 'fallback').message).toBe('fallback')
  })
})
