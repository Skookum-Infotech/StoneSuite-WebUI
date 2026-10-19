import type { RecordEmailMessage } from '@/types/recordEmail';

// recordEmailKey is the react-query key for one record's email conversation, so
// the code that sends a document can refresh the Communication tab.
export const recordEmailKey = (recordId: string) => ['record-emails', recordId] as const;

// How often an open Communication tab re-reads the conversation, so a customer's
// reply shows up without a reload — the same cadence as the detail page's poll.
export const RECORD_EMAIL_POLL_MS = 60_000;

const STAFF_FALLBACK_NAME = 'Team';
const CUSTOMER_FALLBACK_NAME = 'Customer';

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

// newestFirst returns the conversation as the tab shows it (latest on top)
// without mutating the cached, oldest-first list.
export function newestFirst(messages: RecordEmailMessage[]): RecordEmailMessage[] {
  return [...messages].reverse();
}
