// When an admin invites someone without typing a name, the backend stores the
// invitee's email as their full name. Showing that email back in the
// "Full name" field (and letting it be submitted as-is) leaves the user with
// an email as their display name — so treat an email-shaped name as "no name".

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when the value looks like an email address rather than a person's name. */
export function looksLikeEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/**
 * The value to prefill the invite form's "Full name" field with: the invite's
 * stored name, or empty when that name is missing or is just the email.
 */
export function inviteFullNameDefault(fullName: string | undefined, email: string | undefined): string {
  const name = (fullName ?? '').trim();
  if (!name) return '';
  if (email && name.toLowerCase() === email.trim().toLowerCase()) return '';
  if (looksLikeEmail(name)) return '';
  return name;
}
