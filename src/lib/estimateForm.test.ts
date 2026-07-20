import { describe, it, expect } from 'vitest'
import { ESTIMATE_CONVERTIBLE_STATUSES } from './estimateForm'

describe('ESTIMATE_CONVERTIBLE_STATUSES', () => {
  it.each([
    ['DRFT', false],
    ['PAPV', false],
    ['APPV', true],
    ['SENT', true],
    ['RJCT', false],
    ['EXPR', false],
    ['CANC', false],
  ])('has(%p) -> %p', (code, expected) => {
    expect(ESTIMATE_CONVERTIBLE_STATUSES.has(code)).toBe(expected)
  })
})
