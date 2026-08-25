import { describe, it, expect } from 'vitest'
import { resolveStatusOptions, isTerminalTarget, type StatusOption } from './statusTransitions'

const STATUSES: StatusOption[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'OPEN', label: 'Open' },
  { code: 'FILL', label: 'Filled' },
  { code: 'CANC', label: 'Cancelled' },
]

const TRANSITIONS: Record<string, string[]> = {
  DRFT: ['OPEN', 'CANC'],
  OPEN: ['FILL', 'CANC'],
  FILL: [],
  CANC: [],
}

describe('resolveStatusOptions', () => {
  it('offers the whole catalog and is never terminal without allowedTransitions', () => {
    const { options, isTerminal } = resolveStatusOptions(STATUSES, 'DRFT')
    expect(options).toEqual(STATUSES)
    expect(isTerminal).toBe(false)
  })

  it('offers only the current status plus its legal moves', () => {
    const { options } = resolveStatusOptions(STATUSES, 'DRFT', TRANSITIONS)
    expect(options.map((s) => s.code)).toEqual(['DRFT', 'OPEN', 'CANC'])
  })

  it.each([
    ['DRFT', false],
    ['OPEN', false],
    ['FILL', true],
    ['CANC', true],
  ])('isTerminal for current status %p -> %p', (value, expected) => {
    expect(resolveStatusOptions(STATUSES, value, TRANSITIONS).isTerminal).toBe(expected)
  })
})

describe('isTerminalTarget', () => {
  it('is never terminal without allowedTransitions', () => {
    expect(isTerminalTarget('FILL')).toBe(false)
  })

  it.each([
    ['DRFT', false],
    ['OPEN', false],
    ['FILL', true],
    ['CANC', true],
  ])('isTerminalTarget(%p) -> %p', (code, expected) => {
    expect(isTerminalTarget(code, TRANSITIONS)).toBe(expected)
  })

  it('treats a code missing from the map as terminal', () => {
    expect(isTerminalTarget('UNKNOWN', TRANSITIONS)).toBe(true)
  })
})
