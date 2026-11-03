import { describe, it, expect } from 'vitest'
import { resolveGeo } from './addressGeo'

const lookups = {
  countries: [
    { id: 1, code: 'US', name: 'United States' },
    { id: 2, code: 'CA', name: 'Canada' },
  ],
  states: [
    { id: 10, code: 'AR', name: 'Arkansas', countryId: 1 },
    { id: 11, code: 'ON', name: 'Ontario', countryId: 2 },
  ],
}

describe('resolveGeo', () => {
  const cases = [
    { name: 'both ids', state: 10, country: 1, expState: 'Arkansas', expCountry: 'United States' },
    { name: 'country only', state: null, country: 2, expState: undefined, expCountry: 'Canada' },
    { name: 'state only', state: 11, country: undefined, expState: 'Ontario', expCountry: undefined },
    { name: 'unknown ids', state: 99, country: 99, expState: undefined, expCountry: undefined },
  ]
  it.each(cases)('$name', ({ state, country, expState, expCountry }) => {
    const geo = resolveGeo(lookups, state, country)
    expect(geo.state?.name).toBe(expState)
    expect(geo.country?.name).toBe(expCountry)
  })

  it('carries the flag kind and code', () => {
    const geo = resolveGeo(lookups, 10, 1)
    expect(geo.state?.flag).toEqual({ kind: 'state', code: 'AR' })
    expect(geo.country?.flag).toEqual({ kind: 'country', code: 'US' })
  })

  it('resolves nothing before lookups load', () => {
    expect(resolveGeo(undefined, 10, 1)).toEqual({ state: null, country: null })
  })
})
