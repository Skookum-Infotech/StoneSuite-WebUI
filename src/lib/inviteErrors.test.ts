import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { parseInviteError } from './inviteErrors';

function makeError(status: number, data: unknown) {
  return new AxiosError('Request failed', String(status), undefined, undefined, {
    status,
    data,
  } as never);
}

describe('parseInviteError', () => {
  it('classifies a 409 as a conflict, carrying the backend message', () => {
    const info = parseInviteError(
      makeError(409, {
        message: 'This email already has a pending invitation. Use Resend from the Invites list to send it again.',
      }),
    );
    expect(info.kind).toBe('conflict');
    expect(info.message).toContain('already has a pending invitation');
  });

  it('classifies a 409 "already a member" as a conflict', () => {
    const info = parseInviteError(
      makeError(409, { message: 'This email address is already a member of this workspace.' }),
    );
    expect(info.kind).toBe('conflict');
  });

  it('classifies a 400 as validation', () => {
    const info = parseInviteError(makeError(400, { message: 'email is required.' }));
    expect(info.kind).toBe('validation');
  });

  it('classifies a 500 as generic', () => {
    const info = parseInviteError(makeError(500, { message: 'Failed to create invitation.' }));
    expect(info.kind).toBe('generic');
    expect(info.message).toBe('Failed to create invitation.');
  });

  it('falls back when the response carries no message', () => {
    const info = parseInviteError(makeError(500, {}), 'Something went wrong.');
    expect(info.kind).toBe('generic');
    expect(info.message).toBe('Request failed');
  });

  it('handles a non-Axios error with the fallback', () => {
    const info = parseInviteError('boom', 'Fallback text.');
    expect(info.kind).toBe('generic');
    expect(info.message).toBe('Fallback text.');
  });

  it('uses an Error instance message when it is not an AxiosError', () => {
    const info = parseInviteError(new Error('network down'), 'Fallback text.');
    expect(info.kind).toBe('generic');
    expect(info.message).toBe('network down');
  });
});
