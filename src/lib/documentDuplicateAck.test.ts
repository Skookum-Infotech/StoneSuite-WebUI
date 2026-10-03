import { describe, it, expect, beforeEach } from 'vitest';
import { acknowledgeDuplicates, clearDuplicateAck, isDuplicateAcknowledged } from './documentDuplicateAck';
import { clearAllDrafts } from './documentReviewDraft';

describe('documentDuplicateAck', () => {
  beforeEach(() => window.sessionStorage.clear());

  it.each([
    { name: 'acknowledged record', ack: ['so-1'], ext: 'x', uuid: 'so-1', want: true },
    { name: 'a different record (second clerk)', ack: ['so-1'], ext: 'x', uuid: 'so-2', want: false },
    { name: 'record the server did not name', ack: ['so-1'], ext: 'x', uuid: undefined, want: false },
    { name: 'another extraction', ack: ['so-1'], ext: 'y', uuid: 'so-1', want: false },
    { name: 'nothing acknowledged', ack: [], ext: 'x', uuid: 'so-1', want: false },
  ])('$name -> $want', ({ ack, ext, uuid, want }) => {
    acknowledgeDuplicates('x', ack);
    expect(isDuplicateAcknowledged(ext, uuid)).toBe(want);
  });

  it('is forgotten on clear and on logout', () => {
    acknowledgeDuplicates('x', ['so-1']);
    clearDuplicateAck('x');
    expect(isDuplicateAcknowledged('x', 'so-1')).toBe(false);
    acknowledgeDuplicates('x', ['so-1']);
    clearAllDrafts();
    expect(isDuplicateAcknowledged('x', 'so-1')).toBe(false);
  });
});
