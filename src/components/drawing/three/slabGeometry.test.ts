import { describe, expect, it } from 'vitest';
import type { EdgeFinish } from '@/types/drawing';
import { PROFILE_LEVELS } from '@/lib/drawing/three/profileRings';
import type { PieceSolid } from '@/lib/drawing/three/solids';
import { bowlGeometry, profiledSlabGeometry } from './slabGeometry';
import { FACE_BOTTOM, FACE_SIDE, FACE_TOP } from './shapes';

const box = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: -600 }, { x: 0, y: -600 }];
const hole = [{ x: 300, y: -200 }, { x: 700, y: -200 }, { x: 700, y: -400 }, { x: 300, y: -400 }];

function solid(finishes: EdgeFinish[], holes = [] as typeof box[]): PieceSolid {
  return {
    id: 'p', label: 'A-1', outline: box, holes, thicknessMm: 30, baseMm: 884, panels: [], seams: [], texture: null,
    slabPhoto: 'none', segmentFinishes: finishes, bowls: [],
  };
}

function vertices(geometry: ReturnType<typeof profiledSlabGeometry>, kind: number): number {
  return geometry.groups.filter((g) => g.materialIndex === kind).reduce((sum, g) => sum + g.count, 0);
}

describe('profiledSlabGeometry', () => {
  const geometry = profiledSlabGeometry(solid(['none', 'bullnose', 'none', 'none']));

  it('covers every vertex with a group, in whole triangles, with no broken numbers', () => {
    const position = geometry.getAttribute('position');
    expect(position.count % 3).toBe(0);
    expect(geometry.groups.reduce((sum, g) => sum + g.count, 0)).toBe(position.count);
    for (let i = 0; i < position.array.length; i += 1) expect(Number.isFinite(position.array[i])).toBe(true);
  });

  it('has a top and an underside face of two triangles each, and a wall slice per level per side', () => {
    expect(vertices(geometry, FACE_TOP)).toBe(6);
    expect(vertices(geometry, FACE_BOTTOM)).toBe(6);
    expect(vertices(geometry, FACE_SIDE)).toBe(PROFILE_LEVELS * 4 * 6);
  });

  it('pulls the top face in at the finished side', () => {
    const position = geometry.getAttribute('position');
    const topGroup = geometry.groups.find((g) => g.materialIndex === FACE_TOP);
    if (!topGroup) throw new Error('expected a top face');
    let maxX = -Infinity;
    for (let i = topGroup.start; i < topGroup.start + topGroup.count; i += 1) maxX = Math.max(maxX, position.getX(i));
    expect(maxX).toBeCloseTo(985, 0);
    expect(position.getZ(topGroup.start)).toBeCloseTo(30);
  });

  it('adds a wall round each opening and leaves it out of both faces', () => {
    const withHole = profiledSlabGeometry(solid(['none', 'bullnose', 'none', 'none'], [hole]));
    expect(vertices(withHole, FACE_SIDE)).toBe(PROFILE_LEVELS * 4 * 6 + 4 * 6);
    expect(vertices(withHole, FACE_TOP)).toBeGreaterThan(6);
  });
});

describe('bowlGeometry', () => {
  it('is four walls and a floor, hanging below zero', () => {
    const bowl = bowlGeometry(hole, 200);
    expect(bowl.getAttribute('position').count).toBe(4 * 6 + 6);
    const position = bowl.getAttribute('position');
    let lowest = Infinity;
    let highest = -Infinity;
    for (let i = 0; i < position.count; i += 1) {
      lowest = Math.min(lowest, position.getZ(i));
      highest = Math.max(highest, position.getZ(i));
    }
    expect(lowest).toBe(-200);
    expect(highest).toBe(0);
  });
});
