import { describe, it, expect } from 'vitest';
import { formatFreshness } from './dashboardFreshness';

const NOW = 1_700_000_000_000;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe('formatFreshness', () => {
  it('reports an in-flight background refresh regardless of the timestamp', () => {
    expect(formatFreshness(NOW - HOUR, true, NOW)).toBe('Updating…');
  });

  it('reports "not loaded" when nothing has resolved yet', () => {
    expect(formatFreshness(null, false, NOW)).toBe('Not loaded');
  });

  it('collapses the first few seconds to "just now"', () => {
    expect(formatFreshness(NOW - 3 * SECOND, false, NOW)).toBe('Updated just now');
  });

  it('counts seconds under a minute', () => {
    expect(formatFreshness(NOW - 42 * SECOND, false, NOW)).toBe('Updated 42s ago');
  });

  it('counts whole minutes under an hour', () => {
    expect(formatFreshness(NOW - 5 * MINUTE - 20 * SECOND, false, NOW)).toBe('Updated 5m ago');
  });

  it('counts whole hours past an hour', () => {
    expect(formatFreshness(NOW - 2 * HOUR, false, NOW)).toBe('Updated 2h ago');
  });

  it('never reports a negative age when the clock skews', () => {
    expect(formatFreshness(NOW + 5 * SECOND, false, NOW)).toBe('Updated just now');
  });
});
