import { describe, expect, it } from 'vitest';
import { cameraPose, VIEW_PRESETS } from './cameraViews';

const bounds = { centerX: 1000, centerY: 500, sizeMm: 2000 };

describe('cameraPose', () => {
  it.each(VIEW_PRESETS.map((v) => v.id))('looks at the middle of the pieces, at counter height (%s)', (preset) => {
    const { target } = cameraPose(preset, bounds);
    expect(target[0]).toBeCloseTo(1);
    expect(target[1]).toBeCloseTo(0.914);
    expect(target[2]).toBeCloseTo(-0.5);
  });

  it('puts the top view straight above and the front view in front (south) of the pieces', () => {
    const top = cameraPose('top', bounds);
    expect(top.position[1]).toBeGreaterThan(top.target[1] + 1);
    expect(Math.abs(top.position[0] - top.target[0])).toBeLessThan(0.01);
    const front = cameraPose('front', bounds);
    expect(front.position[2]).toBeGreaterThan(front.target[2]);
  });

  it('stands further back for bigger layouts', () => {
    const small = cameraPose('iso', { ...bounds, sizeMm: 1000 });
    const large = cameraPose('iso', { ...bounds, sizeMm: 4000 });
    expect(large.position[1] - large.target[1]).toBeGreaterThan(small.position[1] - small.target[1]);
  });
});
