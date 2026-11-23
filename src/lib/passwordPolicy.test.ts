import { describe, expect, it } from 'vitest'
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  evaluatePasswordRules,
  isStrongPassword,
  passwordStrength,
  strongPasswordSchema,
} from './passwordPolicy'

const STRONG = 'Abcdef1!'
// Pads a prefix that satisfies every rule out to an exact byte length.
const padToBytes = (bytes: number) => 'Aa1!' + 'a'.repeat(bytes - 4)

describe('strongPasswordSchema', () => {
  const cases: { name: string; password: string; message: string | null }[] = [
    { name: 'accepts a password meeting every rule', password: STRONG, message: null },
    { name: 'accepts exactly the minimum length', password: 'Aa1!aaaa', message: null },
    { name: 'rejects an empty password', password: '', message: `Must be at least ${PASSWORD_MIN_LENGTH} characters` },
    { name: 'rejects a password below the minimum length', password: 'Ab1!', message: `Must be at least ${PASSWORD_MIN_LENGTH} characters` },
    { name: 'rejects a password with no uppercase letter', password: 'abcdefg1!', message: 'Must include an uppercase letter' },
    { name: 'rejects a password with no lowercase letter', password: 'ABCDEFG1!', message: 'Must include a lowercase letter' },
    { name: 'rejects a password with no number', password: 'Abcdefgh!', message: 'Must include a number' },
    { name: 'rejects a password with no special character', password: 'Abcdefg1', message: 'Must include a special character' },
    { name: 'does not count a space as a special character', password: 'Abcdefg 1', message: 'Must include a special character' },
    { name: 'does not count an accented letter as a special character', password: 'Ünicode1', message: 'Must include a special character' },
    { name: 'accepts a password at the byte limit', password: padToBytes(PASSWORD_MAX_BYTES), message: null },
    { name: 'rejects a password over the byte limit', password: padToBytes(PASSWORD_MAX_BYTES + 1), message: `Must be ${PASSWORD_MAX_BYTES} bytes or fewer (non-ASCII characters use more than one)` },
    // 39 characters but 74 bytes — the byte limit, not the character count, is what bcrypt enforces.
    { name: 'measures the limit in bytes, not characters', password: 'Aa1!' + 'é'.repeat(35), message: `Must be ${PASSWORD_MAX_BYTES} bytes or fewer (non-ASCII characters use more than one)` },
  ]

  it.each(cases)('$name', ({ password, message }) => {
    const result = strongPasswordSchema.safeParse(password)
    if (message === null) {
      expect(result.success).toBe(true)
    } else {
      expect(result.success).toBe(false)
      // The first issue is what the form shows under the field.
      expect(result.error?.issues[0].message).toBe(message)
    }
  })
})

describe('isStrongPassword', () => {
  it('agrees with the schema', () => {
    expect(isStrongPassword(STRONG)).toBe(true)
    expect(isStrongPassword('Abcdefg1')).toBe(false)
  })
})

describe('evaluatePasswordRules', () => {
  it('reports one result per rule, in the order shown to the user', () => {
    expect(evaluatePasswordRules('').map((r) => r.rule.id)).toEqual(PASSWORD_RULES.map((r) => r.id))
  })

  it('marks only the satisfied rules as met', () => {
    const met = Object.fromEntries(evaluatePasswordRules('abcdefgh').map((r) => [r.rule.id, r.met]))
    expect(met).toEqual({ length: true, uppercase: false, lowercase: true, number: false, special: false })
  })
})

describe('passwordStrength', () => {
  const cases: { password: string; level: number; label: string }[] = [
    { password: '', level: 0, label: '' },
    { password: 'a', level: 1, label: 'Weak' },
    { password: 'abcdefgh', level: 1, label: 'Weak' },
    { password: 'Abcdefgh', level: 2, label: 'Fair' },
    { password: 'Abcdefg1', level: 3, label: 'Good' },
    { password: STRONG, level: 4, label: 'Strong' },
  ]

  it.each(cases)('rates "$password" as level $level', ({ password, level, label }) => {
    expect(passwordStrength(password)).toEqual({ level, label })
  })

  it('only ever says Strong for a password the schema accepts', () => {
    const samples = ['', 'a', 'abcdefgh', 'Abcdefgh', 'Abcdefg1', 'Abcdef1!', 'ABCDEFG1!', 'abcdefg1!']
    for (const password of samples) {
      expect(passwordStrength(password).level === 4).toBe(isStrongPassword(password))
    }
  })
})
