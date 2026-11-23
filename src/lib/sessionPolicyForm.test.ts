import { describe, it, expect } from 'vitest';
import { changedLimits, parseLimit } from './sessionPolicyForm';

describe('parseLimit', () => {
  it.each([
    ['0', 100, 0, null],
    ['5', 100, 5, null],
    [' 12 ', 100, 12, null],
    ['100', 100, 100, null],
    ['101', 100, null, 'Must be 100 or less.'],
    ['', 100, null, 'Enter a number (0 turns it off).'],
    ['-1', 100, null, 'Enter a whole number, 0 or more.'],
    ['2.5', 100, null, 'Enter a whole number, 0 or more.'],
    ['abc', 100, null, 'Enter a whole number, 0 or more.'],
  ])('%j (max %i)', (raw, max, value, error) => {
    expect(parseLimit(raw, max)).toEqual({ value, error });
  });
});

describe('changedLimits', () => {
  const saved = { cooldown: 5, cap: 5 };
  it.each([
    ['nothing changed', { cooldown: 5, cap: 5 }, {}],
    ['wait changed', { cooldown: 10, cap: 5 }, { takeoverCooldownMinutes: 10 }],
    ['cap changed to off', { cooldown: 5, cap: 0 }, { takeoverDailyCap: 0 }],
    ['both', { cooldown: 0, cap: 3 }, { takeoverCooldownMinutes: 0, takeoverDailyCap: 3 }],
    ['invalid box is left out', { cooldown: null, cap: 3 }, { takeoverDailyCap: 3 }],
  ])('%s', (_name, edited, want) => {
    expect(changedLimits(saved, edited)).toEqual(want);
  });
});
