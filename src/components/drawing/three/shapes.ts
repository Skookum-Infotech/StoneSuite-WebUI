// Small three.js helpers shared by the 3D meshes.

import { ExtrudeGeometry, Path, Shape } from 'three';
import type { Point } from '@/types/drawing';

/** Material slots of a slab: the face that shows, the face underneath, and the sides. */
export const FACE_TOP = 0;
export const FACE_BOTTOM = 1;
export const FACE_SIDE = 2;

/** How close to a face's height a vertex must be to count as on it (the shape is in mm). */
const FACE_EPSILON_MM = 1e-6;
const VERTICES_PER_TRIANGLE = 3;

function pathOf<T extends Path>(target: T, points: Point[]): T {
  points.forEach((p, i) => (i === 0 ? target.moveTo(p.x, p.y) : target.lineTo(p.x, p.y)));
  target.closePath();
  return target;
}

/** Re-groups an extrusion's triangles by face. Out of the box three.js puts the top and the
 *  bottom face in one group, so they cannot be painted differently. */
export function groupFaces(geometry: ExtrudeGeometry, depthMm: number): void {
  const position = geometry.getAttribute('position');
  const triangles = position.count / VERTICES_PER_TRIANGLE;
  const kindOf = (triangle: number): number => {
    const heights = [0, 1, 2].map((k) => position.getZ(triangle * VERTICES_PER_TRIANGLE + k));
    if (heights.every((z) => Math.abs(z - depthMm) < FACE_EPSILON_MM)) return FACE_TOP;
    if (heights.every((z) => Math.abs(z) < FACE_EPSILON_MM)) return FACE_BOTTOM;
    return FACE_SIDE;
  };

  geometry.clearGroups();
  let runStart = 0;
  let runKind = kindOf(0);
  for (let t = 1; t < triangles; t += 1) {
    const kind = kindOf(t);
    if (kind === runKind) continue;
    geometry.addGroup(runStart * VERTICES_PER_TRIANGLE, (t - runStart) * VERTICES_PER_TRIANGLE, runKind);
    runStart = t;
    runKind = kind;
  }
  geometry.addGroup(runStart * VERTICES_PER_TRIANGLE, (triangles - runStart) * VERTICES_PER_TRIANGLE, runKind);
}

/** `outline` (with `holes` punched through) extruded `depthMm` along the shape's +z. The
 *  shape is in the drawing's own millimetres; the meshes lay it flat (see PieceMesh). */
export function extrudeOutline(outline: Point[], holes: Point[][], depthMm: number): ExtrudeGeometry {
  const shape = pathOf(new Shape(), outline);
  shape.holes = holes.map((hole) => pathOf(new Path(), hole));
  return new ExtrudeGeometry(shape, { depth: depthMm, bevelEnabled: false });
}
