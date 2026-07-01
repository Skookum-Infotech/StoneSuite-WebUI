import { describe, it, expect } from 'vitest'
import { validateCrmRecord } from './crmValidation'
import type { FieldDefinition } from '@/types/tenant'

// Domain logic: required-field validation across core + custom fields.
// Table-driven where it pays off; explicit cases where intent is clearer.
describe('validateCrmRecord — custom field requirements', () => {
  const requiredCustom: FieldDefinition[] = [
    { key: 'priority', label: 'Priority', required: true } as FieldDefinition,
  ]

  it('flags a required custom field that is empty', () => {
    const errors = validateCrmRecord({}, requiredCustom, { priority: '' })
    expect(errors).toContainEqual({ key: 'priority', label: 'Priority' })
  })

  it('does not flag a required custom field that has a value', () => {
    const errors = validateCrmRecord({}, requiredCustom, { priority: 'high' })
    expect(errors.find((e) => e.key === 'priority')).toBeUndefined()
  })

  it('ignores optional custom fields entirely', () => {
    const optional: FieldDefinition[] = [
      { key: 'note', label: 'Note', required: false } as FieldDefinition,
    ]
    const errors = validateCrmRecord({}, optional, {})
    // Required core fields may still be flagged; an optional custom field never is.
    expect(errors.find((e) => e.key === 'note')).toBeUndefined()
  })

  it.each([undefined, null, ''])('treats %p as missing', (val) => {
    const errors = validateCrmRecord({}, requiredCustom, { priority: val })
    expect(errors).toContainEqual({ key: 'priority', label: 'Priority' })
  })
})
