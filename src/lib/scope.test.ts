import { describe, it, expect } from 'vitest'
import { SCOPES, normalizeScope, normalizeScopeList } from './scope'

describe('normalizeScope', () => {
  it.each([
    ['all', 'all'],
    ['own', 'own'],
    // Retired scope from a legacy tenant — behaves as `own` server-side.
    ['team', 'own'],
    ['', 'own'],
    [undefined, 'own'],
    [null, 'own'],
    ['nonsense', 'own'],
  ])('normalizeScope(%p) -> %p', (input, expected) => {
    expect(normalizeScope(input)).toBe(expected)
  })
})

describe('normalizeScopeList', () => {
  it.each([
    [['all', 'own'], ['all', 'own']],
    // A legacy catalog collapses to the two supported scopes without a dupe.
    [['all', 'team', 'own'], ['all', 'own']],
    [['own'], ['own']],
    [['team'], ['own']],
    [[], SCOPES],
    [undefined, SCOPES],
  ])('normalizeScopeList(%p) -> %p', (input, expected) => {
    expect(normalizeScopeList(input)).toEqual(expected)
  })
})
