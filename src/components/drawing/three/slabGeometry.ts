// Triangle meshes for the 3D view that three.js cannot extrude on its own: a slab whose sides have
// finished edges (built from the stacked rings in lib/drawing/three/profileRings.ts) and the
// steel bowl under a sink. Like the plain extrusions, they are built in the shape's own space —
// the drawing's millimetres with z up — and the meshes lay them flat (see PieceMesh).
//
// Faces are not indexed, so every triangle keeps its own flat normal and a 90 degree corner stays
// crisp. The materials that draw these are double-sided, so winding order is not significant.

import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';
import type { Point } from '@/types/drawing';
import { profileRings } from '@/lib/drawing/three/profileRings';
import type { PieceSolid } from '@/lib/drawing/three/solids';
import { FACE_BOTTOM, FACE_SIDE, FACE_TOP } from './shapes';

type Vec3 = [number, number, number];

/** A flat polygon (with openings) at height z, as triangles. */
function capTriangles(outline: Point[], holes: Point[][], z: number): Vec3[] {
  const toVec = (p: Point) => new Vector2(p.x, p.y);
  const contour = outline.map(toVec);
  const holeVecs = holes.map((h) => h.map(toVec));
  const all = [...contour, ...holeVecs.flat()];
  return ShapeUtils.triangulateShape(contour, holeVecs).flatMap((face) => face.map((i): Vec3 => [all[i].x, all[i].y, z]));
}

/** A vertical wall along a closed polygon, from z0 to z1. */
function wallTriangles(polygon: Point[], z0: number, z1: number): Vec3[] {
  return polygon.flatMap((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    return [
      [a.x, a.y, z0], [b.x, b.y, z0], [b.x, b.y, z1],
      [a.x, a.y, z0], [b.x, b.y, z1], [a.x, a.y, z1],
    ] as Vec3[];
  });
}

/** The faces of each kind, joined into one geometry with a material group per kind. */
function assemble(faces: Array<{ kind: number; triangles: Vec3[] }>): BufferGeometry {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  faces.forEach(({ kind, triangles }) => {
    if (triangles.length === 0) return;
    geometry.addGroup(positions.length / 3, triangles.length, kind);
    triangles.forEach((v) => positions.push(...v));
  });
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The slab of `solid` with each side cut to its finish. Needs `solid.segmentFinishes`. */
export function profiledSlabGeometry(solid: PieceSolid): BufferGeometry {
  const rings = profileRings(solid.outline, solid.segmentFinishes ?? [], solid.thicknessMm);
  const side: Vec3[] = [];
  for (let k = 0; k < rings.length - 1; k += 1) {
    const upper = rings[k];
    const lower = rings[k + 1];
    upper.points.forEach((a, j) => {
      const next = (j + 1) % upper.points.length;
      const b = upper.points[next];
      const c = lower.points[next];
      const d = lower.points[j];
      side.push(
        [a.x, a.y, upper.heightMm], [b.x, b.y, upper.heightMm], [c.x, c.y, lower.heightMm],
        [a.x, a.y, upper.heightMm], [c.x, c.y, lower.heightMm], [d.x, d.y, lower.heightMm],
      );
    });
  }
  const first = rings[0];
  const last = rings[rings.length - 1];
  solid.holes.forEach((hole) => side.push(...wallTriangles(hole, 0, solid.thicknessMm)));
  return assemble([
    { kind: FACE_TOP, triangles: capTriangles(first.points, solid.holes, first.heightMm) },
    { kind: FACE_BOTTOM, triangles: capTriangles(last.points, solid.holes, last.heightMm) },
    { kind: FACE_SIDE, triangles: side },
  ]);
}

/** An open-topped bowl hanging `depthMm` below z = 0 under the sink opening `outline`. */
export function bowlGeometry(outline: Point[], depthMm: number): BufferGeometry {
  return assemble([
    { kind: 0, triangles: wallTriangles(outline, 0, -depthMm) },
    { kind: 1, triangles: capTriangles(outline, [], -depthMm) },
  ]);
}
