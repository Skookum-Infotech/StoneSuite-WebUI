import { describe, it, expect, beforeEach } from 'vitest';
import { getLastActivity, idleFor, markActivity, resetActivityForTests } from './userActivity';

const T0 = 1_000_000_000_000;
const KEY = 'stonesuite-last-activity';

describe('userActivity', () => {
  beforeEach(() => resetActivityForTests(T0));

  it('measures idle time from the last activity', () => {
    markActivity(T0 + 1000, true);
    expect(idleFor(T0 + 61_000)).toBe(60_000);
  });

  it('never moves backwards', () => {
    markActivity(T0 + 5000, true);
    markActivity(T0 + 1000, true);
    expect(getLastActivity()).toBe(T0 + 5000);
  });

  it('shares activity with the other tabs of the browser', () => {
    markActivity(T0 + 1000, true);
    expect(localStorage.getItem(KEY)).toBe(String(T0 + 1000));
    localStorage.setItem(KEY, String(T0 + 90_000)); // another tab was used later
    expect(getLastActivity()).toBe(T0 + 90_000);
    expect(idleFor(T0 + 100_000)).toBe(10_000);
  });

  it('throttles storage writes but still tracks activity in this tab', () => {
    markActivity(T0 + 10_000, true);
    markActivity(T0 + 11_000); // within the throttle: not written...
    expect(localStorage.getItem(KEY)).toBe(String(T0 + 10_000));
    expect(getLastActivity()).toBe(T0 + 11_000); // ...but counted here
    markActivity(T0 + 20_000);
    expect(localStorage.getItem(KEY)).toBe(String(T0 + 20_000));
  });

  it('is never negative', () => {
    markActivity(T0 + 5000, true);
    expect(idleFor(T0)).toBe(0);
  });
});
