import { describe, expect, it } from 'vitest';
import { snapshotFileName } from './snapshot';

describe('snapshotFileName', () => {
  it.each([
    ['Kitchen', 'kitchen-3d.png'],
    ['Kitchen Island!', 'kitchen-island-3d.png'],
    ['  Area 1 ', 'area-1-3d.png'],
    ['', 'drawing-3d.png'],
    ['???', 'drawing-3d.png'],
  ])('names %j as %s', (name, expected) => {
    expect(snapshotFileName(name)).toBe(expected);
  });

  it('keeps a very long name short and never ends the stem with a dash', () => {
    const name = snapshotFileName(`${'a'.repeat(39)} bbbbbb`);
    expect(name.length).toBeLessThanOrEqual(40 + '-3d.png'.length);
    expect(name).not.toMatch(/--/);
    expect(name.endsWith('-3d.png')).toBe(true);
  });
});
