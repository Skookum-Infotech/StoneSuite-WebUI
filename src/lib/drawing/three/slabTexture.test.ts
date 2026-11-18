import { describe, expect, it } from 'vitest';
import type { Piece, SlabPlacement } from '@/types/drawing';
import { rectOutline, transformOutline } from '../geometry';
import { placedOutline } from '../slabs';
import { pieceTexture, slabUv } from './slabTexture';

const photos = { s1: { photoUrl: 'https://x/s1.jpg', lengthMm: 3000, widthMm: 1500 } };

function piece(overrides: Partial<Piece> = {}): Piece {
  return {
    id: 'p', label: 'A-1', shape: 'rect', outline: rectOutline(1000, 600), position: { x: 0, y: 0 },
    rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
    slab: { slabId: 's1', x: 100, y: 200, rotationDeg: 0 }, ...overrides,
  };
}

describe('pieceTexture', () => {
  it('is null for a piece that is not on a slab, or whose slab has no photo', () => {
    expect(pieceTexture(piece({ slab: undefined }), [], photos)).toBeNull();
    expect(pieceTexture(piece({ slab: { slabId: 'other', x: 0, y: 0, rotationDeg: 0 } }), [], photos)).toBeNull();
  });

  it('is null when the piece runs off the slab', () => {
    const offEdge = piece({ slab: { slabId: 's1', x: 2800, y: 200, rotationDeg: 0 } });
    expect(pieceTexture(offEdge, [offEdge], photos)).toBeNull();
  });

  it('is null when another piece overlaps it on the slab', () => {
    const a = piece();
    const b = piece({ id: 'q', slab: { slabId: 's1', x: 300, y: 300, rotationDeg: 0 } });
    expect(pieceTexture(a, [a, b], photos)).toBeNull();
  });

  it('is set for a piece that fits', () => {
    const a = piece();
    expect(pieceTexture(a, [a], photos)).not.toBeNull();
  });
});

describe('slabUv', () => {
  it('maps the top-left corner of the piece to its spot on the slab (v measured up from the bottom)', () => {
    const a = piece();
    const texture = pieceTexture(a, [a], photos);
    if (!texture) throw new Error('expected a texture');
    // Local (0,0) is the top-left corner of the piece: slab (100, 200).
    const [u, v] = slabUv({ x: 0, y: 0 }, texture);
    expect(u).toBeCloseTo(100 / 3000);
    expect(v).toBeCloseTo(1 - 200 / 1500);
  });

  it('runs along the slab as the piece runs along x, and down the slab as it runs down y', () => {
    const a = piece();
    const texture = pieceTexture(a, [a], photos);
    if (!texture) throw new Error('expected a texture');
    const [u1] = slabUv({ x: 1000, y: 0 }, texture);
    expect(u1).toBeCloseTo(1100 / 3000);
    const [, v1] = slabUv({ x: 0, y: -600 }, texture);
    expect(v1).toBeCloseTo(1 - 800 / 1500);
  });

  it.each([0, 90, 180, 270])('lands every corner where the Material tab lays it on the slab (slab turned %i degrees)', (slabRotationDeg) => {
    const a = piece({
      outline: [{ x: 0, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: -300 }, { x: 600, y: -300 }, { x: 600, y: -700 }, { x: 0, y: -700 }],
      position: { x: 4200, y: -900 },
      rotationDeg: 37,
      slab: { slabId: 's1', x: 150, y: 120, rotationDeg: slabRotationDeg },
    });
    const texture = pieceTexture(a, [a], photos);
    if (!texture) throw new Error('expected a texture');
    const onSlab = placedOutline(a, a.slab as SlabPlacement);
    transformOutline(a.outline, a.position, a.rotationDeg).forEach((world, i) => {
      const [u, v] = slabUv(world, texture);
      expect(u * photos.s1.lengthMm).toBeCloseTo(onSlab[i].x, 3);
      expect((1 - v) * photos.s1.widthMm).toBeCloseTo(onSlab[i].y, 3);
    });
  });

  it('follows the piece when it is moved and turned on the board', () => {
    const a = piece({ position: { x: 5000, y: 300 }, rotationDeg: 90 });
    const texture = pieceTexture(a, [a], photos);
    if (!texture) throw new Error('expected a texture');
    // The piece's own origin, wherever it stands on the board, is still slab (100, 200).
    const [u, v] = slabUv({ x: 5000, y: 300 }, texture);
    expect(u).toBeCloseTo(100 / 3000);
    expect(v).toBeCloseTo(1 - 200 / 1500);
  });
});
