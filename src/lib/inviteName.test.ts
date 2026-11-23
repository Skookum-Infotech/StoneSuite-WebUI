import { describe, it, expect } from 'vitest';
import { inviteFullNameDefault, looksLikeEmail } from './inviteName';

describe('looksLikeEmail', () => {
  it.each([
    ['ss-multirole@skookuminfotech.com', true],
    ['  jane@acme.io  ', true],
    ['Jane Smith', false],
    ['jane@', false],
    ['', false],
  ])('%j → %s', (input, expected) => {
    expect(looksLikeEmail(input)).toBe(expected);
  });
});

describe('inviteFullNameDefault', () => {
  const email = 'ss-multirole@skookuminfotech.com';

  it.each([
    ['real name is kept', 'Jane Smith', email, 'Jane Smith'],
    ['name is trimmed', '  Jane Smith ', email, 'Jane Smith'],
    ['name equal to the email is dropped', email, email, ''],
    ['email match is case-insensitive', 'SS-MultiRole@SkookumInfotech.com', email, ''],
    ['any email-shaped name is dropped', 'other@acme.io', email, ''],
    ['missing name gives empty', undefined, email, ''],
    ['blank name gives empty', '   ', email, ''],
    ['missing email still keeps a real name', 'Jane Smith', undefined, 'Jane Smith'],
  ])('%s', (_label, fullName, inviteEmail, expected) => {
    expect(inviteFullNameDefault(fullName, inviteEmail)).toBe(expected);
  });
});
