import { describe, it, expect } from 'vitest'
import { toOccurredAtPayload, fromOccurredAtIso, ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from './crmActivityForm'

describe('toOccurredAtPayload', () => {
  it('returns undefined for a blank value, letting the server default to now', () => {
    expect(toOccurredAtPayload('')).toBeUndefined()
  })

  it('converts a datetime-local value to the equivalent UTC instant', () => {
    const payload = toOccurredAtPayload('2026-07-20T14:30')
    expect(payload).toBeDefined()
    expect(new Date(payload!).getTime()).toBe(new Date('2026-07-20T14:30').getTime())
  })
})

describe('fromOccurredAtIso', () => {
  it('returns an empty string for a blank value', () => {
    expect(fromOccurredAtIso('')).toBe('')
  })

  it('converts an ISO instant to a datetime-local value representing the same instant', () => {
    const iso = '2026-07-20T18:45:00.000Z'
    const local = fromOccurredAtIso(iso)
    expect(new Date(local).getTime()).toBe(new Date(iso).getTime())
  })
})

describe('toOccurredAtPayload / fromOccurredAtIso round trip', () => {
  it('preserves the same wall-clock minute there and back', () => {
    const original = '2026-07-20T09:15'
    const iso = toOccurredAtPayload(original)!
    expect(fromOccurredAtIso(iso)).toBe(original)
  })
})

describe('ACTIVITY_TYPES / ACTIVITY_TYPE_LABELS', () => {
  it('has exactly the five enum values the backend accepts, in a stable order', () => {
    expect(ACTIVITY_TYPES).toEqual(['call', 'email', 'meeting', 'note', 'task'])
  })

  it('has a label for every activity type and no extras', () => {
    expect(Object.keys(ACTIVITY_TYPE_LABELS).sort()).toEqual([...ACTIVITY_TYPES].sort())
  })
})
