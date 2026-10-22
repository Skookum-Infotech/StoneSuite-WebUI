import type { RecordEmailMessage } from '@/types/recordEmail';

// recordEmailKey is the react-query key for one record's email conversation, so
// the code that sends a document can refresh the Communication tab.
export const recordEmailKey = (recordId: string) => ['record-emails', recordId] as const;

// How often an open Communication tab re-reads the conversation, so a customer's
// reply shows up without a reload — the same cadence as the detail page's poll.
export const RECORD_EMAIL_POLL_MS = 60_000;

// The longest message the backend accepts (it counts characters, not bytes).
export const REPLY_MAX_CHARS = 10_000;

const STAFF_FALLBACK_NAME = 'Team';
const CUSTOMER_FALLBACK_NAME = 'Customer';

const NO_INBOUND_REASON =
  'Email replies are not set up for this workspace yet. You can still add internal notes.';
const NO_CUSTOMER_EMAIL_REASON =
  'There is no customer email to reply to yet — use Send to customer first. You can still add internal notes.';

// senderName is what a message card shows as its author: the person's name,
// else their address, else a neutral label for the side they are on.
export function senderName(m: Pick<RecordEmailMessage, 'direction' | 'fromName' | 'fromEmail'>): string {
  const fallback = m.direction === 'out' ? STAFF_FALLBACK_NAME : CUSTOMER_FALLBACK_NAME;
  return m.fromName.trim() || m.fromEmail.trim() || fallback;
}

// avatarInitials is the one or two letters in a message's avatar circle.
export function avatarInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return letters || '?';
}

interface ComposerModeInput {
  // The thread's `enabled` flag: inbound email is set up for the workspace.
  emailEnabled: boolean;
  // Where a reply would go; '' before the first email was sent.
  replyTo: string;
  // The "Internal only" switch as the user left it.
  internalOnly: boolean;
}

export interface ComposerMode {
  // What Send does now: true saves a team note, false emails the customer.
  internal: boolean;
  // The switch cannot be turned off, because an email cannot be sent.
  locked: boolean;
  // Why it is locked, for the line under the composer ('' when it is not).
  lockReason: string;
}

// composerMode decides whether the next Send emails the customer or only saves a
// note. A note is always possible; an email needs inbound email to be set up and
// a customer address, so without those the switch is locked on and says why.
export function composerMode({ emailEnabled, replyTo, internalOnly }: ComposerModeInput): ComposerMode {
  if (!emailEnabled) return { internal: true, locked: true, lockReason: NO_INBOUND_REASON };
  if (replyTo.trim() === '') return { internal: true, locked: true, lockReason: NO_CUSTOMER_EMAIL_REASON };
  return { internal: internalOnly, locked: false, lockReason: '' };
}

// conversationSummary is the count line above the thread: real emails and team
// notes are counted apart, since a note is not an email.
export function conversationSummary(messages: RecordEmailMessage[]): string {
  const notes = messages.filter((m) => m.internal).length;
  const emails = messages.length - notes;
  const parts: string[] = [];
  if (emails > 0) parts.push(emails === 1 ? '1 email' : `${emails} emails`);
  if (notes > 0) parts.push(notes === 1 ? '1 internal note' : `${notes} internal notes`);
  return parts.join(' · ');
}
