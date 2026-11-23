import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  workspaceUnavailableMessage,
  setAuthNotice,
  peekAuthNotice,
  clearAuthNotice,
} from './authNotice';

describe('workspaceUnavailableMessage', () => {
  it.each([
    ['suspended', { code: 'workspace_suspended', message: 'This workspace is suspended.' }, 'This workspace is suspended.'],
    ['deleted', { code: 'workspace_deleted', message: 'This workspace has been deleted.' }, 'This workspace has been deleted.'],
    ['unavailable', { code: 'workspace_unavailable', message: 'Down for maintenance.' }, 'Down for maintenance.'],
  ])('returns the server message for a %s workspace', (_name, body, expected) => {
    expect(workspaceUnavailableMessage(body)).toBe(expected);
  });

  it('falls back to a generic message when the server sent a code but no text', () => {
    const message = workspaceUnavailableMessage({ code: 'workspace_suspended' });

    expect(message).toMatch(/workspace/i);
    expect(message).not.toBe('');
  });

  it.each([
    ['no body', undefined],
    ['a null body', null],
    ['a string body', 'Forbidden'],
    ['no code', { message: 'You do not have permission.' }],
    ['an unrelated code', { code: 'rate_limited', message: 'Slow down.' }],
    ['a non-string code', { code: 42, message: 'x' }],
    ['a code that only contains the prefix', { code: 'not_workspace_suspended', message: 'x' }],
  ])('returns null for %s — an ordinary 403 must not end the session', (_name, body) => {
    expect(workspaceUnavailableMessage(body)).toBeNull();
  });
});

describe('auth notice storage', () => {
  beforeEach(() => clearAuthNotice());
  afterEach(() => {
    clearAuthNotice();
    vi.restoreAllMocks();
  });

  it('round-trips a message and keeps it until cleared', () => {
    setAuthNotice('This workspace is suspended.');

    expect(peekAuthNotice()).toBe('This workspace is suspended.');
    expect(peekAuthNotice()).toBe('This workspace is suspended.');

    clearAuthNotice();
    expect(peekAuthNotice()).toBeNull();
  });

  it('is empty when nothing was stored', () => {
    expect(peekAuthNotice()).toBeNull();
  });

  it('never throws when storage is unavailable (private window, blocked site data)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => setAuthNotice('x')).not.toThrow();
    expect(peekAuthNotice()).toBeNull();
    expect(() => clearAuthNotice()).not.toThrow();
  });
});
