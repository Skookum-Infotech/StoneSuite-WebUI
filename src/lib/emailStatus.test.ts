import { describe, it, expect } from 'vitest';
import { EMAIL_STATUS_LABEL, normalizeEmailStatus } from './emailStatus';

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
      sent: 'Sent',
      retrying: 'Retrying',
      delayed: 'Delayed',
      delivered: 'Delivered',
      complained: 'Marked as spam',
      bounced: 'Bounced',
      failed: 'Failed',
      suppressed: 'Not sent',
      skipped: 'Skipped',
    });
  });
});
