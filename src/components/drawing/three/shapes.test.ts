import { describe, expect, it } from 'vitest';
import { extrudeOutline, FACE_BOTTOM, FACE_SIDE, FACE_TOP, groupFaces } from './shapes';

const box = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: -600 }, { x: 0, y: -600 }];
const hole = [{ x: 300, y: -200 }, { x: 700, y: -200 }, { x: 700, y: -400 }, { x: 300, y: -400 }];

function vertexCountByFace(geometry: ReturnType<typeof extrudeOutline>): Record<number, number> {
  const counts: Record<number, number> = {};
  geometry.groups.forEach((g) => { counts[g.materialIndex ?? -1] = (counts[g.materialIndex ?? -1] ?? 0) + g.count; });
  return counts;
}

describe('groupFaces', () => {
  it('covers every vertex exactly once', () => {
    const geometry = extrudeOutline(box, [hole], 30);
    groupFaces(geometry, 30);
    const total = geometry.groups.reduce((sum, g) => sum + g.count, 0);
    expect(total).toBe(geometry.getAttribute('position').count);
  });

  it('puts the top and the bottom face in different groups with the same number of triangles', () => {
    const geometry = extrudeOutline(box, [hole], 30);
    groupFaces(geometry, 30);
    const counts = vertexCountByFace(geometry);
    expect(counts[FACE_TOP]).toBeGreaterThan(0);
    expect(counts[FACE_BOTTOM]).toBe(counts[FACE_TOP]);
    expect(counts[FACE_SIDE]).toBeGreaterThan(0);
  });

  it('only puts vertices at full height in the top group', () => {
    const geometry = extrudeOutline(box, [], 30);
    groupFaces(geometry, 30);
    const position = geometry.getAttribute('position');
    geometry.groups.filter((g) => g.materialIndex === FACE_TOP).forEach((g) => {
      for (let i = g.start; i < g.start + g.count; i += 1) expect(position.getZ(i)).toBeCloseTo(30);
    });
  });
});
