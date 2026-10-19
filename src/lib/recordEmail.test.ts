import { describe, it, expect } from 'vitest';
import { avatarInitials, newestFirst, recordEmailKey, senderName } from './recordEmail';
import type { RecordEmailMessage } from '@/types/recordEmail';

function msg(over: Partial<RecordEmailMessage> = {}): RecordEmailMessage {
  return {
    id: 'm1', recordId: 'rec-1', workflowKey: 'sales_order', direction: 'in', fromName: '', fromEmail: '',
    to: '', cc: '', subject: '', body: '', attachmentCount: 0, createdAt: '2026-10-16T10:00:00Z', ...over,
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

describe('newestFirst', () => {
  it('reverses without mutating the cached list', () => {
    const list = [msg({ id: 'a' }), msg({ id: 'b' }), msg({ id: 'c' })];
    expect(newestFirst(list).map((m) => m.id)).toEqual(['c', 'b', 'a']);
    expect(list.map((m) => m.id)).toEqual(['a', 'b', 'c']);
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
