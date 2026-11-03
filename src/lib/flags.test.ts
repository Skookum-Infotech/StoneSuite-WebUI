import { describe, it, expect } from 'vitest'
import { countryFlagCode, flagAttrs, lookupFlagAttrs, parseFlagAttr, stateFlagUrl } from './flags'

describe('countryFlagCode', () => {
  const cases: Array<[string | undefined, string | null]> = [
    ['US', 'us'],
    ['in', 'in'],
    [' ca ', 'ca'],
    ['USA', 'us'],
    ['GBR', 'gb'],
    ['XYZ', null],
    ['', null],
    [undefined, null],
    ['U1', null],
  ]
  it.each(cases)('maps %j to %j', (input, expected) => {
    expect(countryFlagCode(input)).toBe(expected)
  })
})

describe('stateFlagUrl', () => {
  const cases: Array<[string | undefined, string | null]> = [
    ['AR', '/flags/states/AR.svg'],
    ['tx', '/flags/states/TX.svg'],
    ['Texas', null],
    ['', null],
    [undefined, null],
  ]
  it.each(cases)('maps %j to %j', (input, expected) => {
    expect(stateFlagUrl(input)).toBe(expected)
  })
})

describe('flag attributes', () => {
  it('round-trips through the data attribute', () => {
    const attrs = flagAttrs('state', 'AR')
    expect(attrs).toEqual({ 'data-flag': 'state:AR' })
    expect(parseFlagAttr(attrs['data-flag'])).toEqual({ kind: 'state', code: 'AR' })
  })

  it('emits nothing without a code', () => {
    expect(flagAttrs('country', '')).toEqual({})
    expect(flagAttrs('country', undefined)).toEqual({})
  })

  it('only tags countries and states lookups', () => {
    expect(lookupFlagAttrs('countries', { code: 'US' })).toEqual({ 'data-flag': 'country:US' })
    expect(lookupFlagAttrs('states', { code: 'AR' })).toEqual({ 'data-flag': 'state:AR' })
    expect(lookupFlagAttrs('currencies', { code: 'USD' })).toEqual({})
  })

  it('rejects malformed attribute values', () => {
    expect(parseFlagAttr(undefined)).toBeNull()
    expect(parseFlagAttr('US')).toBeNull()
    expect(parseFlagAttr('city:Paris')).toBeNull()
  })
})
