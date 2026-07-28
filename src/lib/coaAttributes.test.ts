import { describe, it, expect } from 'vitest'
import {
  attrFieldsFor, hasAttributes, missingRequiredAttrs,
  BANK_ACCOUNT_NUMBER_KEY,
} from './coaAttributes'
import { ACCOUNT_TYPES, type AccountType } from '@/types/chartOfAccounts'

describe('attrFieldsFor', () => {
  const cases: Array<[AccountType, string[]]> = [
    ['general', []],
    ['ar', []],
    ['ap', []],
    ['inventory', []],
    ['cash', ['location']],
    ['tax', ['taxRegistrationNumber', 'jurisdiction']],
    ['fixed_asset', ['assetTag', 'usefulLifeYears']],
    ['bank', ['bankName', 'accountNumber', 'branch', 'routingNumber', 'swift']],
    ['credit_card', ['issuer', 'last4', 'network']],
  ]

  it.each(cases)('returns the fixed schema keys for %s', (type, expectedKeys) => {
    expect(attrFieldsFor(type).map((f) => f.key)).toEqual(expectedKeys)
  })

  it('covers every account type', () => {
    expect(cases.map(([t]) => t).sort()).toEqual([...ACCOUNT_TYPES].sort())
  })

  it('marks bankName and accountNumber required for bank, branch/routingNumber/swift optional', () => {
    const fields = attrFieldsFor('bank')
    const required = fields.filter((f) => f.required).map((f) => f.key)
    const optional = fields.filter((f) => !f.required).map((f) => f.key)
    expect(required).toEqual(['bankName', BANK_ACCOUNT_NUMBER_KEY])
    expect(optional).toEqual(['branch', 'routingNumber', 'swift'])
  })

  it('marks issuer/last4 required for credit_card, network optional', () => {
    const fields = attrFieldsFor('credit_card')
    expect(fields.filter((f) => f.required).map((f) => f.key)).toEqual(['issuer', 'last4'])
    expect(fields.filter((f) => !f.required).map((f) => f.key)).toEqual(['network'])
  })

  it('flags only accountNumber as writeOnly', () => {
    const fields = attrFieldsFor('bank')
    expect(fields.find((f) => f.key === BANK_ACCOUNT_NUMBER_KEY)?.writeOnly).toBe(true)
    expect(fields.find((f) => f.key === 'bankName')?.writeOnly).toBe(false)
  })
})

describe('hasAttributes', () => {
  it.each([
    ['general', false], ['ar', false], ['ap', false], ['inventory', false],
    ['cash', true], ['tax', true], ['fixed_asset', true], ['bank', true], ['credit_card', true],
  ] as Array<[AccountType, boolean]>)('%s -> %s', (type, expected) => {
    expect(hasAttributes(type)).toBe(expected)
  })
})

describe('missingRequiredAttrs', () => {
  it('returns every required key when attrs is empty', () => {
    expect(missingRequiredAttrs('bank', {})).toEqual(['bankName', BANK_ACCOUNT_NUMBER_KEY])
  })

  it('treats a blank/whitespace-only value as missing', () => {
    expect(missingRequiredAttrs('credit_card', { issuer: '  ', last4: '1234' })).toEqual(['issuer'])
  })

  it('returns [] once every required key is present', () => {
    expect(missingRequiredAttrs('credit_card', { issuer: 'Visa', last4: '1234' })).toEqual([])
  })

  it('returns [] for a type with no attributes regardless of input', () => {
    expect(missingRequiredAttrs('general', { anything: 'x' })).toEqual([])
  })

  it('never flags an optional key as missing', () => {
    expect(missingRequiredAttrs('bank', { bankName: 'Chase', [BANK_ACCOUNT_NUMBER_KEY]: '12345' })).toEqual([])
  })
})
