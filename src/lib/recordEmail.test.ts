import { describe, it, expect } from 'vitest';
import {
  NOT_KEPT_REASONS,
  REPLY_FILE_ACCEPT,
  REPLY_MAX_FILES,
  REPLY_MAX_TOTAL_BYTES,
  avatarInitials,
  communicationCopy,
  composerMode,
  conversationSummary,
  formatFileSize,
  missingAttachmentCount,
  recordEmailKey,
  senderName,
  validateReplyFiles,
} from './recordEmail';
import type { RecordEmailMessage } from '@/types/recordEmail';

function msg(over: Partial<RecordEmailMessage> = {}): RecordEmailMessage {
  return {
    id: 'm1', recordId: 'rec-1', workflowKey: 'sales_order', direction: 'in', fromName: '', fromEmail: '',
    to: '', cc: '', subject: '', body: '', attachmentCount: 0, attachments: [], internal: false, createdAt: '2026-10-16T10:00:00Z', ...over,
  };
}

describe('recordEmailKey', () => {
  it('is a stable per-record key other components can invalidate', () => {
    expect(recordEmailKey('rec-1')).toEqual(['record-emails', 'rec-1']);
  });
});

describe('senderName', () => {
  it.each([
    ['name wins', msg({ fromName: 'Priya Shah', fromEmail: 'p@x.com' }), 'Priya Shah'],
    ['falls back to the address', msg({ fromName: '  ', fromEmail: 'p@x.com' }), 'p@x.com'],
    ['neutral label for an unknown customer', msg({ direction: 'in' }), 'Customer'],
    ['neutral label for unknown staff', msg({ direction: 'out' }), 'Team'],
  ])('%s', (_label, m, want) => {
    expect(senderName(m)).toBe(want);
  });

  it('calls an unknown sender by the other party of the conversation', () => {
    expect(senderName(msg({ direction: 'in' }), 'customer')).toBe('Customer');
    expect(senderName(msg({ direction: 'in' }), 'vendor')).toBe('Vendor');
    expect(senderName(msg({ direction: 'out' }), 'vendor')).toBe('Team');
  });
});

describe('communicationCopy', () => {
  it('words a customer conversation around Send to customer', () => {
    const copy = communicationCopy('customer');
    expect(copy.emptyHint).toBe('Use Send to customer to start the conversation.');
    expect(copy.replyLabel).toBe('Reply to the customer');
    expect(copy.replyPlaceholder).toBe('Write a reply to the customer…');
    expect(copy.notCapturedNotice).toMatch(/^Customer replies are not being captured yet/);
  });

  it('words a vendor conversation around Send to Vendor', () => {
    const copy = communicationCopy('vendor');
    expect(copy.emptyHint).toBe('Use Send to Vendor to start the conversation.');
    expect(copy.replyLabel).toBe('Reply to the vendor');
    expect(copy.notCapturedNotice).toMatch(/^Vendor replies are not being captured yet/);
  });

  it('words a team-notes timeline with no email talk at all', () => {
    const copy = communicationCopy('internal');
    expect(copy.emptyTitle).toBe('No notes yet');
    expect(copy.notCapturedNotice).toBe('');
  });
});

describe('avatarInitials', () => {
  it.each([
    ['Priya Shah', 'PS'],
    ['priya', 'P'],
    ['Ana Maria Lopez', 'AM'],
    ['  ', '?'],
  ])('%s -> %s', (name, want) => {
    expect(avatarInitials(name)).toBe(want);
  });
});

describe('composerMode', () => {
  it.each([
    ['an email by default', { emailEnabled: true, replyTo: 'p@x.com', internalOnly: false }, { internal: false, locked: false }],
    ['a note when the switch is on', { emailEnabled: true, replyTo: 'p@x.com', internalOnly: true }, { internal: true, locked: false }],
    ['locked to notes without inbound email', { emailEnabled: false, replyTo: 'p@x.com', internalOnly: false }, { internal: true, locked: true }],
    ['locked to notes before any email was sent', { emailEnabled: true, replyTo: '', internalOnly: false }, { internal: true, locked: true }],
    ['a blank address counts as none', { emailEnabled: true, replyTo: '  ', internalOnly: false }, { internal: true, locked: true }],
  ])('%s', (_label, input, want) => {
    const mode = composerMode(input);
    expect(mode.internal).toBe(want.internal);
    expect(mode.locked).toBe(want.locked);
  });

  it('explains a lock, and says nothing when the switch is free', () => {
    expect(composerMode({ emailEnabled: false, replyTo: 'p@x.com', internalOnly: false }).lockReason).toMatch(/not set up/);
    expect(composerMode({ emailEnabled: true, replyTo: '', internalOnly: false }).lockReason).toMatch(/Send to customer first/);
    expect(composerMode({ emailEnabled: true, replyTo: 'p@x.com', internalOnly: true }).lockReason).toBe('');
  });

  it('names the vendor and its send button before a purchase order has been emailed', () => {
    const mode = composerMode({ emailEnabled: true, replyTo: '', internalOnly: false, audience: 'vendor' });
    expect(mode.locked).toBe(true);
    expect(mode.lockReason).toMatch(/no vendor email to reply to yet — use Send to Vendor first/);
  });

  it.each([
    ['inbound email off', { emailEnabled: false, replyTo: '' }],
    ['no address yet', { emailEnabled: true, replyTo: '' }],
    ['a reply address', { emailEnabled: true, replyTo: 'p@x.com' }],
  ])('a team-notes record is always a note with no switch: %s', (_label, input) => {
    expect(composerMode({ ...input, internalOnly: false, audience: 'internal' })).toEqual({
      internal: true, locked: true, notesOnly: true, lockReason: '',
    });
  });

  it('only a team-notes record is notes-only', () => {
    expect(composerMode({ emailEnabled: true, replyTo: 'p@x.com', internalOnly: false }).notesOnly).toBe(false);
    expect(composerMode({ emailEnabled: false, replyTo: '', internalOnly: false, audience: 'vendor' }).notesOnly).toBe(false);
  });
});

describe('conversationSummary', () => {
  it.each([
    ['no messages', [], ''],
    ['one email', [msg()], '1 email'],
    ['several emails', [msg(), msg({ id: 'b' })], '2 emails'],
    ['only notes', [msg({ internal: true })], '1 internal note'],
    ['emails and notes counted apart', [msg(), msg({ id: 'b', internal: true }), msg({ id: 'c', internal: true })], '1 email · 2 internal notes'],
  ])('%s', (_label, messages, want) => {
    expect(conversationSummary(messages)).toBe(want);
  });

  it.each([
    ['no notes', [], ''],
    ['one note', [msg({ internal: true })], '1 note'],
    ['several notes', [msg({ internal: true }), msg({ id: 'b', internal: true })], '2 notes'],
  ])('on a team-notes record, %s are plain notes', (_label, messages, want) => {
    expect(conversationSummary(messages, 'internal')).toBe(want);
  });
});

function file(name: string, size: number): File {
  // A File's size is its content length; this builds one of exactly that many bytes.
  return new File([new Uint8Array(size)], name);
}

describe('the reply limits', () => {
  it('are the numbers the backend enforces: 5 files, 5 MB in total', () => {
    expect(REPLY_MAX_FILES).toBe(5);
    expect(REPLY_MAX_TOTAL_BYTES).toBe(5 * 1024 * 1024);
  });

  it('offer the file picker exactly the allowed types', () => {
    expect(REPLY_FILE_ACCEPT).toContain('.pdf');
    expect(REPLY_FILE_ACCEPT).toContain('.heic');
    expect(REPLY_FILE_ACCEPT).toContain('.dwg');
    expect(REPLY_FILE_ACCEPT).not.toContain('.exe');
    expect(REPLY_FILE_ACCEPT.split(',').every((ext) => ext.startsWith('.'))).toBe(true);
  });
});

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1024, '1 KB'],
    [350 * 1024, '350 KB'],
    [1024 * 1024 - 1, '1024 KB'],
    [1024 * 1024, '1.0 MB'],
    [1.5 * 1024 * 1024, '1.5 MB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('%d bytes -> %s', (bytes, want) => {
    expect(formatFileSize(bytes)).toBe(want);
  });
});

describe('validateReplyFiles', () => {
  it('accepts allowed files that fit, in the order picked', () => {
    const picked = [file('Quote.PDF', 100), file('kitchen.heic', 200), file('plan.dwg', 300)];
    const { accepted, errors } = validateReplyFiles([], picked);
    expect(accepted).toEqual(picked);
    expect(errors).toEqual([]);
  });

  it('skips a file of a type that cannot be attached and keeps the rest', () => {
    const good = file('a.pdf', 10);
    const { accepted, errors } = validateReplyFiles([], [file('setup.exe', 10), good, file('README', 10)]);
    expect(accepted).toEqual([good]);
    expect(errors).toEqual([
      'setup.exe is not a file type that can be attached.',
      'README is not a file type that can be attached.',
    ]);
  });

  it('skips an empty file', () => {
    const { accepted, errors } = validateReplyFiles([], [file('empty.pdf', 0)]);
    expect(accepted).toEqual([]);
    expect(errors).toEqual(['empty.pdf is empty.']);
  });

  it('counts the files already attached against the limit and says so once', () => {
    const existing = [file('1.pdf', 1), file('2.pdf', 1), file('3.pdf', 1), file('4.pdf', 1)];
    const first = file('5.pdf', 1);
    const { accepted, errors } = validateReplyFiles(existing, [first, file('6.pdf', 1), file('7.pdf', 1)]);
    expect(accepted).toEqual([first]);
    expect(errors).toEqual(['Attach at most 5 files.']);
  });

  it('accepts a total of exactly the limit and refuses the file that would pass it', () => {
    const half = REPLY_MAX_TOTAL_BYTES / 2;
    const ok = validateReplyFiles([], [file('a.pdf', half), file('b.pdf', half)]);
    expect(ok.accepted).toHaveLength(2);
    expect(ok.errors).toEqual([]);

    const over = validateReplyFiles([file('a.pdf', half)], [file('b.pdf', half + 1)]);
    expect(over.accepted).toEqual([]);
    expect(over.errors).toEqual(['b.pdf was not added: attachments are limited to 5 MB in total.']);
  });

  it('lets a smaller file through after a bigger one did not fit', () => {
    const small = file('small.pdf', 10);
    const { accepted, errors } = validateReplyFiles([file('a.pdf', REPLY_MAX_TOTAL_BYTES - 100)], [file('big.pdf', 1000), small]);
    expect(accepted).toEqual([small]);
    expect(errors).toHaveLength(1);
  });

  it('matches the type case-insensitively and by the last extension only', () => {
    expect(validateReplyFiles([], [file('PLAN.DWG', 5)]).accepted).toHaveLength(1);
    expect(validateReplyFiles([], [file('archive.tar.zip', 5)]).accepted).toHaveLength(1);
    expect(validateReplyFiles([], [file('invoice.pdf.exe', 5)]).accepted).toHaveLength(0);
  });
});

describe('missingAttachmentCount', () => {
  it.each([
    ['no files at all', msg({ attachmentCount: 0 }), 0],
    ['every file listed', msg({ attachmentCount: 1, attachments: [{ id: 'a', fileName: 'x.pdf', contentType: '', sizeBytes: 1, inline: false, status: 'stored' }] }), 0],
    ['a message from before files were kept', msg({ attachmentCount: 3 }), 3],
    ['some listed, some not', msg({ attachmentCount: 3, attachments: [{ id: 'a', fileName: 'x.pdf', contentType: '', sizeBytes: 1, inline: false, status: 'stored' }] }), 2],
    ['more listed than counted never goes negative', msg({ attachmentCount: 0, attachments: [{ id: 'a', fileName: 'x.pdf', contentType: '', sizeBytes: 1, inline: false, status: 'stored' }] }), 0],
  ])('%s', (_label, m, want) => {
    expect(missingAttachmentCount(m)).toBe(want);
  });
});

describe('NOT_KEPT_REASONS', () => {
  it('explains every status in which a received file was not kept', () => {
    expect(Object.keys(NOT_KEPT_REASONS).sort()).toEqual(['blocked', 'too_large', 'unavailable']);
    for (const reason of Object.values(NOT_KEPT_REASONS)) {
      expect(reason.label).not.toBe('');
      expect(reason.detail.endsWith('.')).toBe(true);
    }
  });
});
