import type { CommunicationAudience, RecordEmailAttachmentStatus, RecordEmailMessage } from '@/types/recordEmail';

// recordEmailKey is the react-query key for one record's email conversation, so
// the code that sends a document can refresh the Communication tab.
export const recordEmailKey = (recordId: string) => ['record-emails', recordId] as const;

// How often an open Communication tab re-reads the conversation, so a customer's
// reply shows up without a reload — the same cadence as the detail page's poll.
export const RECORD_EMAIL_POLL_MS = 60_000;

// The longest message the backend accepts (it counts characters, not bytes).
export const REPLY_MAX_CHARS = 10_000;

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;

// What staff may attach to one message: 5 files, 5 MB in total, of these types.
// The backend enforces the same numbers (recordemail.ReplyMaxFiles,
// ReplyMaxTotalBytes and the reply type list); a change here must be made there too.
export const REPLY_MAX_FILES = 5;
export const REPLY_MAX_TOTAL_MB = 5;
export const REPLY_MAX_TOTAL_BYTES = REPLY_MAX_TOTAL_MB * BYTES_PER_MB;
export const REPLY_ALLOWED_EXTENSIONS: readonly string[] = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'ppt', 'pptx',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif', 'dwg', 'dxf', 'zip',
];
// The file picker's `accept` value for those types.
export const REPLY_FILE_ACCEPT = REPLY_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

const STAFF_FALLBACK_NAME = 'Team';

const NO_INBOUND_REASON =
  'Email replies are not set up for this workspace yet. You can still add internal notes.';

// The words a Communication tab uses for the other end of the conversation.
export interface CommunicationCopy {
  // The other party as a label ('Customer'), and the button that emails them.
  party: string;
  startAction: string;
  emptyTitle: string;
  emptyHint: string;
  // Shown above the thread while inbound email is off; '' for team notes.
  notCapturedNotice: string;
  replyLabel: string;
  replyPlaceholder: string;
}

function emailCopy(party: string, startAction: string): CommunicationCopy {
  const lower = party.toLowerCase();
  return {
    party,
    startAction,
    emptyTitle: 'No emails yet',
    emptyHint: `Use ${startAction} to start the conversation.`,
    notCapturedNotice: `${party} replies are not being captured yet. Ask your administrator to set up inbound email.`,
    replyLabel: `Reply to the ${lower}`,
    replyPlaceholder: `Write a reply to the ${lower}…`,
  };
}

const COMMUNICATION_COPY: Record<CommunicationAudience, CommunicationCopy> = {
  customer: emailCopy('Customer', 'Send to customer'),
  vendor: emailCopy('Vendor', 'Send to Vendor'),
  // A team notes timeline has no other party, so only the empty state is worded.
  internal: {
    party: 'Sender',
    startAction: '',
    emptyTitle: 'No notes yet',
    emptyHint: 'Add a note below to keep your team in the loop.',
    notCapturedNotice: '',
    replyLabel: '',
    replyPlaceholder: '',
  },
};

// communicationCopy is the wording for a tab whose other end is `audience`.
export function communicationCopy(audience: CommunicationAudience): CommunicationCopy {
  return COMMUNICATION_COPY[audience];
}

// senderName is what a message card shows as its author: the person's name,
// else their address, else a neutral label for the side they are on.
export function senderName(
  m: Pick<RecordEmailMessage, 'direction' | 'fromName' | 'fromEmail'>,
  audience: CommunicationAudience = 'customer',
): string {
  const fallback = m.direction === 'out' ? STAFF_FALLBACK_NAME : communicationCopy(audience).party;
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
  // Who the conversation is with; a team-notes record can never email.
  audience?: CommunicationAudience;
}

export interface ComposerMode {
  // What Send does now: true saves a team note, false emails the other party.
  internal: boolean;
  // The switch cannot be turned off, because an email cannot be sent.
  locked: boolean;
  // The record only keeps team notes: there is no switch to show at all.
  notesOnly: boolean;
  // Why it is locked, for the line under the composer ('' when it is not).
  lockReason: string;
}

// composerMode decides whether the next Send emails the other party or only saves
// a note. A note is always possible; an email needs inbound email to be set up and
// an address to write to, so without those the switch is locked on and says why.
// A team-notes record is always a note, and has no switch to lock.
export function composerMode({ emailEnabled, replyTo, internalOnly, audience = 'customer' }: ComposerModeInput): ComposerMode {
  if (audience === 'internal') return { internal: true, locked: true, notesOnly: true, lockReason: '' };
  if (!emailEnabled) return { internal: true, locked: true, notesOnly: false, lockReason: NO_INBOUND_REASON };
  if (replyTo.trim() === '') {
    const { party, startAction } = communicationCopy(audience);
    return {
      internal: true,
      locked: true,
      notesOnly: false,
      lockReason: `There is no ${party.toLowerCase()} email to reply to yet — use ${startAction} first. You can still add internal notes.`,
    };
  }
  return { internal: internalOnly, locked: false, notesOnly: false, lockReason: '' };
}

// conversationSummary is the count line above the thread: real emails and team
// notes are counted apart, since a note is not an email. On a team-notes record
// everything is a note, so they are counted as plain notes.
export function conversationSummary(messages: RecordEmailMessage[], audience: CommunicationAudience = 'customer'): string {
  if (audience === 'internal') {
    return messages.length === 0 ? '' : messages.length === 1 ? '1 note' : `${messages.length} notes`;
  }
  const notes = messages.filter((m) => m.internal).length;
  const emails = messages.length - notes;
  const parts: string[] = [];
  if (emails > 0) parts.push(emails === 1 ? '1 email' : `${emails} emails`);
  if (notes > 0) parts.push(notes === 1 ? '1 internal note' : `${notes} internal notes`);
  return parts.join(' · ');
}

// formatFileSize is a file's size the way a person reads it: "12 B", "340 KB", "1.2 MB".
export function formatFileSize(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${Math.round(bytes / BYTES_PER_KB)} KB`;
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}

export interface ReplyFilesCheck {
  // The incoming files that fit, in the order they were picked.
  accepted: File[];
  // Why the others did not, one sentence each, ready to show.
  errors: string[];
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

// validateReplyFiles decides which of the newly picked files can join those
// already attached, by the same rules the backend applies: an allowed type, not
// empty, at most REPLY_MAX_FILES files and REPLY_MAX_TOTAL_BYTES in total. A file
// that does not fit is skipped, not the whole pick, so one bad file never costs
// the rest.
export function validateReplyFiles(existing: File[], incoming: File[]): ReplyFilesCheck {
  const accepted: File[] = [];
  const errors: string[] = [];
  const addError = (message: string): void => {
    if (!errors.includes(message)) errors.push(message);
  };

  let count = existing.length;
  let total = existing.reduce((sum, file) => sum + file.size, 0);
  for (const file of incoming) {
    if (!REPLY_ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
      addError(`${file.name} is not a file type that can be attached.`);
    } else if (file.size === 0) {
      addError(`${file.name} is empty.`);
    } else if (count >= REPLY_MAX_FILES) {
      addError(`Attach at most ${REPLY_MAX_FILES} files.`);
    } else if (total + file.size > REPLY_MAX_TOTAL_BYTES) {
      addError(`${file.name} was not added: attachments are limited to ${REPLY_MAX_TOTAL_MB} MB in total.`);
    } else {
      accepted.push(file);
      count += 1;
      total += file.size;
    }
  }
  return { accepted, errors };
}

export interface NotKeptReason {
  // Short, on the chip.
  label: string;
  // The sentence behind it, for the tooltip.
  detail: string;
}

// Why a received file cannot be downloaded: the statuses in which it was not kept.
export const NOT_KEPT_REASONS: Record<Exclude<RecordEmailAttachmentStatus, 'stored' | 'pending'>, NotKeptReason> = {
  too_large: {
    label: 'Too large to keep',
    detail: 'This file was larger than the limit for received files. Ask the sender for another way to share it.',
  },
  blocked: {
    label: 'Not kept for safety',
    detail: 'This type of file is never kept, because it can run programs on a computer.',
  },
  unavailable: {
    label: 'Not available',
    detail: 'This file could not be kept. Ask the sender to send it again.',
  },
};

// missingAttachmentCount is how many of a message's files have no entry to show or
// download: all of them for a message from before files were kept.
export function missingAttachmentCount(m: Pick<RecordEmailMessage, 'attachmentCount' | 'attachments'>): number {
  return Math.max(0, m.attachmentCount - m.attachments.length);
}
