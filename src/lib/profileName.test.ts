import { describe, it, expect } from 'vitest'
import {
  PROFILE_NAME_MAX_LENGTH,
  joinFullName,
  profileNameSchema,
  splitFullName,
} from './profileName'

describe('splitFullName', () => {
  it.each([
    { name: 'two words', input: 'Ada Lovelace', want: { firstName: 'Ada', lastName: 'Lovelace' } },
    { name: 'single word', input: 'Prince', want: { firstName: 'Prince', lastName: '' } },
    { name: 'multi-word surname', input: 'Mary Ann Smith', want: { firstName: 'Mary', lastName: 'Ann Smith' } },
    { name: 'surrounding whitespace', input: '  Ada   Lovelace ', want: { firstName: 'Ada', lastName: 'Lovelace' } },
    { name: 'empty', input: '', want: { firstName: '', lastName: '' } },
    { name: 'whitespace only', input: '   ', want: { firstName: '', lastName: '' } },
  ])('$name', ({ input, want }) => {
    expect(splitFullName(input)).toEqual(want)
  })
})

describe('joinFullName', () => {
  it.each([
    { name: 'both parts', first: 'Ada', last: 'Lovelace', want: 'Ada Lovelace' },
    { name: 'trims each part', first: ' Ada ', last: ' Lovelace ', want: 'Ada Lovelace' },
    { name: 'blank last name has no trailing space', first: 'Prince', last: '', want: 'Prince' },
    { name: 'whitespace-only last name', first: 'Prince', last: '   ', want: 'Prince' },
    { name: 'multi-word last name', first: 'Mary', last: 'Ann Smith', want: 'Mary Ann Smith' },
  ])('$name', ({ first, last, want }) => {
    expect(joinFullName(first, last)).toBe(want)
  })

  it('round-trips through splitFullName', () => {
    const { firstName, lastName } = splitFullName('Mary Ann Smith')
    expect(joinFullName(firstName, lastName)).toBe('Mary Ann Smith')
  })
})

describe('profileNameSchema', () => {
  const messageFor = (input: { firstName: string; lastName: string }) => {
    const result = profileNameSchema.safeParse(input)
    return result.success ? null : result.error.issues[0]?.message
  }

  it.each([
    { name: 'first and last', input: { firstName: 'Ada', lastName: 'Lovelace' } },
    { name: 'first only', input: { firstName: 'Prince', lastName: '' } },
    {
      name: 'exactly at the limit',
      input: { firstName: 'a'.repeat(PROFILE_NAME_MAX_LENGTH - 2), lastName: 'b' },
    },
    {
      // 120 astral characters is 240 UTF-16 code units: must pass, since the
      // server counts characters.
      name: 'multi-unit characters at the limit',
      input: { firstName: '😀'.repeat(PROFILE_NAME_MAX_LENGTH), lastName: '' },
    },
  ])('accepts $name', ({ input }) => {
    expect(messageFor(input)).toBeNull()
  })

  it.each([
    { name: 'empty first name', input: { firstName: '', lastName: 'Lovelace' }, want: 'First name is required' },
    { name: 'whitespace-only first name', input: { firstName: '   ', lastName: '' }, want: 'First name is required' },
    {
      name: 'one over the limit',
      input: { firstName: 'a'.repeat(PROFILE_NAME_MAX_LENGTH - 1), lastName: 'b' },
      want: `Name must be ${PROFILE_NAME_MAX_LENGTH} characters or fewer`,
    },
  ])('rejects $name', ({ input, want }) => {
    expect(messageFor(input)).toBe(want)
  })
})
