import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllDrafts, draftKey, readDraft, writeDraft } from './documentReviewDraft';

describe('clearAllDrafts', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('removes every draft but leaves unrelated keys', () => {
    writeDraft('a', { x: 1 });
    writeDraft('b', { x: 2 });
    window.sessionStorage.setItem('other', 'keep');
    clearAllDrafts();
    expect(readDraft('a')).toBeNull();
    expect(readDraft('b')).toBeNull();
    expect(window.sessionStorage.getItem('other')).toBe('keep');
    expect(window.sessionStorage.getItem(draftKey('a'))).toBeNull();
  });
});
