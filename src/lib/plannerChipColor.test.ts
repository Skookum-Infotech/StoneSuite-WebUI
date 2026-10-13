import { describe, it, expect } from 'vitest';
import { chipFillFor, contrastWithWhite } from './plannerChipColor';

// Every status colour the planner can draw: the schedule's four, then a spread
// of invoice-status hexes, including ones that start out far too light.
const STATUS_HEXES = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#a8a29e', '#facc15', '#fde68a', '#22c55e'];

describe('contrastWithWhite', () => {
  it('is 21 for black, 1 for white', () => {
    expect(contrastWithWhite('#000000')).toBeCloseTo(21, 1);
    expect(contrastWithWhite('#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('chipFillFor', () => {
  it.each(STATUS_HEXES)('makes %s dark enough for 12px white text', (hex) => {
    expect(contrastWithWhite(chipFillFor(hex))).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves a colour that already reads on white untouched', () => {
    expect(chipFillFor('#1d4ed8')).toBe('#1d4ed8');
    expect(chipFillFor('#1D4ED8')).toBe('#1d4ed8');
  });

  it('darkens a light colour without changing its hue family', () => {
    const fill = chipFillFor('#10b981'); // emerald: stays green-dominant
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(fill.slice(i, i + 2), 16));
    expect(fill).not.toBe('#10b981');
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('accepts the three-digit form', () => {
    expect(contrastWithWhite(chipFillFor('#fc0'))).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back to a neutral dark fill for something that is not a hex colour', () => {
    expect(chipFillFor('')).toBe('#57534e');
    expect(chipFillFor('green')).toBe('#57534e');
    expect(chipFillFor('#12345')).toBe('#57534e');
  });
});
