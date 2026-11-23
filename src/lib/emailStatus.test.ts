import { describe, it, expect } from 'vitest';
import { EMAIL_STATUS_LABEL, emailStatusExplanation, normalizeEmailStatus } from './emailStatus';

describe('normalizeEmailStatus', () => {
  it.each([
    ['queued', 'queued'],
    ['sent', 'sent'],
    ['retrying', 'retrying'],
    ['delayed', 'delayed'],
    ['delivered', 'delivered'],
    ['complained', 'complained'],
    ['bounced', 'bounced'],
    ['failed', 'failed'],
    ['suppressed', 'suppressed'],
    ['skipped', 'skipped'],
    ['unknown', 'unknown'],
  ])('keeps the known status %s', (raw, want) => {
    expect(normalizeEmailStatus(raw)).toBe(want);
  });

  it.each([[undefined], [''], ['exploded'], ['DELIVERED'], ['delivery_delayed']])(
    'maps %s to unknown so a new backend value can never reach the UI unrendered',
    (raw) => {
      expect(normalizeEmailStatus(raw)).toBe('unknown');
    },
  );
});

describe('EMAIL_STATUS_LABEL', () => {
  it('has a human label for every displayable status', () => {
    expect(EMAIL_STATUS_LABEL).toMatchObject({
      queued: 'Queued',
      sent: 'Awaiting delivery',
      retrying: 'Retrying',
      delayed: 'Delayed',
      delivered: 'Delivered',
      complained: 'Marked as spam',
      bounced: 'Not delivered',
      failed: 'Failed to send',
      suppressed: 'Blocked address',
      skipped: 'Not sent',
    });
  });

  it('never calls an email merely "Sent": the provider says sent long before delivery', () => {
    expect(Object.values(EMAIL_STATUS_LABEL)).not.toContain('Sent');
  });

  it('gives every label to exactly one status, so two states never read the same', () => {
    const labels = Object.values(EMAIL_STATUS_LABEL);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('emailStatusExplanation', () => {
  it('prefers the backend message for a problem', () => {
    expect(emailStatusExplanation({ emailStatus: 'bounced', emailStatusMessage: 'Rejected by the server.' })).toBe(
      'Rejected by the server.',
    );
  });

  it.each([['sent', /delivery isn.t confirmed yet/i], ['queued', /waiting to be handed/i]] as const)(
    'explains the still-open state %s in plain words when the backend sent nothing',
    (status, want) => {
      expect(emailStatusExplanation({ emailStatus: status })).toMatch(want);
    },
  );

  it('adds nothing for a delivered email', () => {
    expect(emailStatusExplanation({ emailStatus: 'delivered' })).toBeUndefined();
  });

  it.each([[undefined], ['unknown' as const]])('adds nothing for %s', (status) => {
    expect(emailStatusExplanation({ emailStatus: status, emailStatusMessage: 'x' })).toBeUndefined();
  });
});
