import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import {
  MFA_CODE_LENGTH,
  MFA_ERROR,
  digitsOnly,
  isChallengeDead,
  mfaErrorInfo,
  toMfaChallenge,
  wrongCodeMessage,
} from './mfa'
import type { AuthResponse } from '@/types/auth'

function apiError(status: number, data: Record<string, unknown>) {
  return new AxiosError('fail', undefined, undefined, undefined, { status, data } as never)
}

describe('digitsOnly', () => {
  it.each([
    ['123456', '123456'],
    ['123 456', '123456'],
    ['123-456', '123456'],
    [' 12a3b4c5d6 ', '123456'],
    ['12345678', '123456'],
    ['abc', ''],
    ['', ''],
  ])('%j -> %j', (input, want) => {
    expect(digitsOnly(input)).toBe(want)
  })

  it('honours a different length', () => {
    expect(digitsOnly('123456', 4)).toBe('1234')
  })
})

describe('toMfaChallenge', () => {
  const asked: AuthResponse = {
    success: true,
    mfaRequired: true,
    challengeToken: 'tok',
    maskedEmail: 'j•••@acme.com',
    codeLength: 6,
    expiresInSeconds: 600,
    resendAfterSeconds: 60,
  }

  it('reads the challenge out of a code-required login response', () => {
    expect(toMfaChallenge(asked)).toEqual({
      success: true,
      challengeToken: 'tok',
      maskedEmail: 'j•••@acme.com',
      codeLength: 6,
      expiresInSeconds: 600,
      resendAfterSeconds: 60,
    })
  })

  it('falls back to the default length and no wait when the server leaves them out', () => {
    const challenge = toMfaChallenge({
      success: true,
      mfaRequired: true,
      challengeToken: 'tok',
      maskedEmail: 'j•••@acme.com',
    })
    expect(challenge?.codeLength).toBe(MFA_CODE_LENGTH)
    expect(challenge?.resendAfterSeconds).toBe(0)
  })

  it.each([
    ['an ordinary login', { success: true, token: 't', expiresAt: 1 }],
    ['mfaRequired false', { ...asked, mfaRequired: false }],
    ['no challenge token', { ...asked, challengeToken: undefined }],
    ['no masked address', { ...asked, maskedEmail: undefined }],
  ] as [string, AuthResponse][])('is null for %s', (_name, response) => {
    expect(toMfaChallenge(response)).toBeNull()
  })
})

describe('mfaErrorInfo', () => {
  it('reads code, message, attempts and wait from an API error', () => {
    const err = apiError(400, {
      code: MFA_ERROR.codeInvalid,
      message: "That code isn't right.",
      attemptsLeft: 3,
      retryAfterSeconds: 12,
    })
    expect(mfaErrorInfo(err, 'fallback')).toEqual({
      code: MFA_ERROR.codeInvalid,
      message: "That code isn't right.",
      attemptsLeft: 3,
      retryAfterSeconds: 12,
    })
  })

  it('uses the fallback when the body has no message', () => {
    expect(mfaErrorInfo(apiError(500, {}), 'fallback').message).toBe('fallback')
  })

  it('uses the fallback for anything that is not an API error', () => {
    expect(mfaErrorInfo(new Error('network down'), 'fallback')).toEqual({ message: 'fallback' })
  })
})

describe('isChallengeDead', () => {
  it.each([
    [MFA_ERROR.challengeExpired, true],
    [MFA_ERROR.challengeLocked, true],
    [MFA_ERROR.codeInvalid, false],
    [MFA_ERROR.resendTooSoon, false],
    [undefined, false],
  ])('%s -> %s', (code, want) => {
    expect(isChallengeDead(code)).toBe(want)
  })
})

describe('wrongCodeMessage', () => {
  it.each([
    [{ message: 'Nope.', attemptsLeft: 4 }, 'Nope. 4 attempts left.'],
    [{ message: 'Nope.', attemptsLeft: 1 }, 'Nope. 1 attempt left.'],
    [{ message: 'Nope.' }, 'Nope.'],
  ])('%j -> %j', (info, want) => {
    expect(wrongCodeMessage(info)).toBe(want)
  })
})
