import { describe, it, expect } from 'vitest'
import { countedQtyDisplay, foundDisplay, lineNeedsReason, lineBlocksPost } from './inventoryCountLines'

describe('countedQtyDisplay', () => {
  it('renders null/undefined as "not counted" — distinct from a counted zero', () => {
    expect(countedQtyDisplay(null)).toBe('not counted')
    expect(countedQtyDisplay(undefined)).toBe('not counted')
  })

  it('renders a counted zero as "0", not "not counted"', () => {
    expect(countedQtyDisplay(0)).toBe('0')
  })

  it('renders a positive count as-is', () => {
    expect(countedQtyDisplay(97)).toBe('97')
  })
})

describe('foundDisplay', () => {
  it('renders null/undefined as "not counted"', () => {
    expect(foundDisplay(null)).toBe('not counted')
    expect(foundDisplay(undefined)).toBe('not counted')
  })

  it('a positive area means Found, zero means Missing', () => {
    expect(foundDisplay(12.5)).toBe('Found')
    expect(foundDisplay(0)).toBe('Missing')
  })
})

describe('lineNeedsReason', () => {
  it('needs a reason when variance is nonzero', () => {
    expect(lineNeedsReason({ variance: 5, isUnexpected: false })).toBe(true)
    expect(lineNeedsReason({ variance: -5, isUnexpected: false })).toBe(true)
  })

  it('needs a reason when flagged unexpected, even with zero variance', () => {
    expect(lineNeedsReason({ variance: 0, isUnexpected: true })).toBe(true)
  })

  it('does not need a reason for a clean, expected line', () => {
    expect(lineNeedsReason({ variance: 0, isUnexpected: false })).toBe(false)
    expect(lineNeedsReason({ variance: null, isUnexpected: false })).toBe(false)
  })
})

describe('lineBlocksPost', () => {
  it('blocks when a reason is needed and missing', () => {
    expect(lineBlocksPost({ variance: 5, isUnexpected: false, reasonId: null })).toBe(true)
    expect(lineBlocksPost({ variance: 0, isUnexpected: true, reasonId: undefined })).toBe(true)
  })

  it('does not block once a reason is recorded', () => {
    expect(lineBlocksPost({ variance: 5, isUnexpected: false, reasonId: 3 })).toBe(false)
  })

  it('does not block a clean line regardless of reason', () => {
    expect(lineBlocksPost({ variance: 0, isUnexpected: false, reasonId: null })).toBe(false)
  })
})
