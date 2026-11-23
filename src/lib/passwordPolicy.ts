import { z } from 'zod'

// Single source of truth for what counts as an acceptable password on every
// screen that sets one (account settings, invite accept, onboarding set-password,
// reset-password). The backend only enforces a minimum length, so this is the
// layer that keeps weak passwords out — keep the form schema, the live
// requirements checklist and the strength meter all reading from here.

export const PASSWORD_MIN_LENGTH = 8
// bcrypt hashes at most 72 bytes; the backend rejects anything longer.
export const PASSWORD_MAX_BYTES = 72

export type PasswordRuleId = 'length' | 'uppercase' | 'lowercase' | 'number' | 'special'

export interface PasswordRule {
  id: PasswordRuleId
  // Short label for the requirements checklist.
  label: string
  // Message shown under the field when this rule is the first one broken.
  message: string
  test: (password: string) => boolean
}

const UPPERCASE_PATTERN = /\p{Lu}/u
const LOWERCASE_PATTERN = /\p{Ll}/u
const NUMBER_PATTERN = /\p{Nd}/u
// Anything that is not a letter, digit or whitespace: a space is not a symbol.
const SPECIAL_PATTERN = /[^\p{L}\p{N}\s]/u

// Order is the order the checklist is drawn in and the order errors surface in.
export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    message: `Must be at least ${PASSWORD_MIN_LENGTH} characters`,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    message: 'Must include an uppercase letter',
    test: (password) => UPPERCASE_PATTERN.test(password),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    message: 'Must include a lowercase letter',
    test: (password) => LOWERCASE_PATTERN.test(password),
  },
  {
    id: 'number',
    label: 'One number',
    message: 'Must include a number',
    test: (password) => NUMBER_PATTERN.test(password),
  },
  {
    id: 'special',
    label: 'One special character (e.g. ! @ # $ %)',
    message: 'Must include a special character',
    test: (password) => SPECIAL_PATTERN.test(password),
  },
]

const TOO_LONG_MESSAGE = `Must be ${PASSWORD_MAX_BYTES} bytes or fewer (non-ASCII characters use more than one)`

const utf8Encoder = new TextEncoder()
const exceedsByteLimit = (password: string) => utf8Encoder.encode(password).length > PASSWORD_MAX_BYTES

export interface PasswordRuleResult {
  rule: PasswordRule
  met: boolean
}

export function evaluatePasswordRules(password: string): PasswordRuleResult[] {
  return PASSWORD_RULES.map((rule) => ({ rule, met: rule.test(password) }))
}

export const strongPasswordSchema = z.string().superRefine((password, ctx) => {
  for (const { rule, met } of evaluatePasswordRules(password)) {
    if (!met) ctx.addIssue({ code: 'custom', message: rule.message })
  }
  if (exceedsByteLimit(password)) ctx.addIssue({ code: 'custom', message: TOO_LONG_MESSAGE })
})

export function isStrongPassword(password: string): boolean {
  return strongPasswordSchema.safeParse(password).success
}

// ── Strength meter ───────────────────────────────────────────────────────────

export interface PasswordStrength {
  // 0 = nothing typed, 1–4 = Weak…Strong (fills that many bars of the meter).
  level: 0 | 1 | 2 | 3 | 4
  label: string
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const
// Rules-met count → meter level. Only "all rules met" reaches Strong, so a
// password missing any checklist rule is never called Strong (the byte-limit
// guard is not a checklist rule and surfaces as a field error instead).
const LEVEL_BY_RULES_MET: readonly PasswordStrength['level'][] = [0, 1, 1, 2, 3, 4]

export function passwordStrength(password: string): PasswordStrength {
  const rulesMet = evaluatePasswordRules(password).filter((r) => r.met).length
  const level = LEVEL_BY_RULES_MET[rulesMet]
  return { level, label: STRENGTH_LABELS[level] }
}
