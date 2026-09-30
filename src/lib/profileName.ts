import { z } from 'zod'

// The backend stores one display name (users.full_name), so the Account
// Settings form's First/Last split is purely presentational: it is parsed out
// of that string for editing and joined back with a single space to save.

// Matches the server's cap (controllers/user_self.go maxProfileNameLen) and the
// admin "Edit display name" dialog.
export const PROFILE_NAME_MAX_LENGTH = 120

export interface NameParts {
  firstName: string
  lastName: string
}

// Everything up to the first run of whitespace is the first name; the rest is
// the last name, so "Mary Ann Smith" edits as first "Mary" / last "Ann Smith".
export function splitFullName(fullName: string): NameParts {
  const [firstName = '', ...rest] = fullName.trim().split(/\s+/)
  return { firstName, lastName: rest.join(' ') }
}

// A blank last name yields just the first name, never a trailing space.
export function joinFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

// Counts characters the way the server does (runes), not UTF-16 code units.
function characterCount(value: string): number {
  return Array.from(value).length
}

export const profileNameSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required'),
    // Optional: an invited user can have a single-word name.
    lastName: z.string().trim(),
  })
  .refine((d) => characterCount(joinFullName(d.firstName, d.lastName)) <= PROFILE_NAME_MAX_LENGTH, {
    message: `Name must be ${PROFILE_NAME_MAX_LENGTH} characters or fewer`,
    path: ['lastName'],
  })

export type ProfileNameFields = z.infer<typeof profileNameSchema>
