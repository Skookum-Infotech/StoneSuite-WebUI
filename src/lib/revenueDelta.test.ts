import { describe, it, expect } from 'vitest'
import { formatRevenueDelta } from './revenueDelta'

describe('formatRevenueDelta', () => {
  it('returns null when priorValue is null (no applicable prior period)', () => {
    expect(formatRevenueDelta(142300, null)).toBeNull()
  })

  it('reads a zero prior value with real current value as "new"', () => {
    expect(formatRevenueDelta(28400, 0)).toEqual({ text: 'new', tone: 'up' })
  })

  it('reads a zero prior value with zero current value as unchanged', () => {
    expect(formatRevenueDelta(0, 0)).toEqual({ text: '—', tone: 'neutral' })
  })

  it('reads growth as an up-arrow percentage', () => {
    expect(formatRevenueDelta(118000, 100000)).toEqual({ text: '▲ 18%', tone: 'up' })
  })

  it('reads decline as a down-arrow percentage using the absolute value', () => {
    expect(formatRevenueDelta(94000, 100000)).toEqual({ text: '▼ 6%', tone: 'warn' })
  })

  it('reads an unchanged value as neutral', () => {
    expect(formatRevenueDelta(100000, 100000)).toEqual({ text: '—', tone: 'neutral' })
  })

  it('rounds to the nearest integer percent', () => {
    expect(formatRevenueDelta(103000, 100000)).toEqual({ text: '▲ 3%', tone: 'up' })
  })
})
