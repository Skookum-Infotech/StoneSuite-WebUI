import { describe, it, expect } from 'vitest';
import { avatarInitials, composerMode, conversationSummary, recordEmailKey, senderName } from './recordEmail';
import type { RecordEmailMessage } from '@/types/recordEmail';

function msg(over: Partial<RecordEmailMessage> = {}): RecordEmailMessage {
  return {
    id: 'm1', recordId: 'rec-1', workflowKey: 'sales_order', direction: 'in', fromName: '', fromEmail: '',
    to: '', cc: '', subject: '', body: '', attachmentCount: 0, internal: false, createdAt: '2026-10-16T10:00:00Z', ...over,
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
});
