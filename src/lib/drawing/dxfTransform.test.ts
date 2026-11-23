import { describe, expect, it, vi } from 'vitest';
import { flattenBulges } from './dxfTransform';

describe('flattenBulges', () => {
  const bulged = (count: number) => Array.from({ length: count }, (_, i) => ({ x: i, y: 0, bulge: 1e6 }));

  // Hundreds of thousands of vertices at ~120 points each would exhaust memory
  // long before the scene's budget got a look at the result.
  it('reports its points as it goes, so the caller can stop it early', () => {
    const budget = new Error('over budget');
    let spent = 0;
    const spend = vi.fn((points: number) => {
      spent += points;
      if (spent > 500) throw budget;
    });

    expect(() => flattenBulges(bulged(1000), false, spend)).toThrow(budget);
    expect(spend.mock.calls.length).toBeLessThan(20);
  });

  it('reports every point it produced', () => {
    let spent = 0;
    const points = flattenBulges(bulged(3), false, (n) => { spent += n; });
    expect(spent).toBe(points.length);
  });

  it('closes on a bulged closing segment', () => {
    const points = flattenBulges([{ x: 0, y: 0, bulge: 1 }, { x: 10, y: 0, bulge: 1 }], true, () => undefined);
    expect(points.at(-1)?.x).toBeCloseTo(0, 6);
    expect(points.at(-1)?.y).toBeCloseTo(0, 6);
  });

  it('does not repeat the first point for a straight closing segment', () => {
    const points = flattenBulges([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], true, () => undefined);
    expect(points).toHaveLength(3);
  });
});
