import { describe, expect, it } from 'vitest';
import { viewerNotices } from './notices';
import type { AreaSolids, PieceSolid } from './solids';

function solids(statuses: PieceSolid['slabPhoto'][], skipped = 0): AreaSolids {
  const pieces = statuses.map((slabPhoto, i) => ({ id: `p${i}`, slabPhoto }) as PieceSolid);
  return { pieces, cabinets: [], skipped, bounds: { centerX: 0, centerY: 0, sizeMm: 1 } };
}

describe('viewerNotices', () => {
  it('says nothing when every piece is fine', () => {
    expect(viewerNotices(solids(['none', 'ready']), 0)).toEqual([]);
  });

  it('explains pieces that do not fit their slab, singular and plural', () => {
    expect(viewerNotices(solids(['misfit']), 0)[0]).toContain('1 piece is not fully inside the slab');
    expect(viewerNotices(solids(['misfit', 'misfit']), 0)[0]).toContain('2 pieces are not fully inside the slab');
  });

  it('explains pieces on a slab with no photo', () => {
    expect(viewerNotices(solids(['missing']), 0)[0]).toContain('no photo');
  });

  it('flags a photo the browser refused to load, and skipped pieces', () => {
    const notices = viewerNotices(solids(['ready'], 2), 1);
    expect(notices).toHaveLength(2);
    expect(notices[0]).toContain('2 pieces');
    expect(notices[1]).toContain('CORS');
  });
});
