// Putting a slab's photo on an attached-profile panel's visible face (an
// upright Backsplash or a dropped Waterfall wall) — PanelMesh's own version
// of slabTexture.ts/slabUv. A panel's visible face isn't a flat top-down
// surface like a piece's own top face is, so a straight top-down planar
// projection would smear the photo into a single vertical streak; instead
// this "unfolds" the face exactly the way the 2D board and the Material tab
// already do for the same profile piece (lib/drawing/attachedProfileGeometry.ts's
// attachedProfileLocalOutline / lib/drawing/slabs.ts's slabOffset), using the
// panel's own position along the painted side and up its own height as the
// two axes instead of world x/y.

import type { Piece, Point, SlabPlacement } from '@/types/drawing';
import { attachedProfileLocalOutline } from '../attachedProfileGeometry';
import { othersOnSlab, placedOutline, slabFit, slabOffset } from '../slabs';
import { profilePlaceableId, type SlabPlaceable } from '../slabPlaceables';
import type { SlabPhoto } from './slabTexture';

export interface PanelTexture extends SlabPhoto {
  /** The profile's own unfolded local rectangle (attachedProfileLocalOutline's
   *  four corners: near-start, near-end, far-end, far-start) — the same local
   *  space the 2D board and the Material tab already place this same profile
   *  piece in. */
  localOutline: [Point, Point, Point, Point];
  offset: Point;
  slabRotationDeg: number;
  /** An 'upright' panel runs from world-Z 0 (its base, at the counter) UP to
   *  its own height; a 'dropped' one runs the opposite way, from the counter
   *  DOWN to world-Z 0 — so a dropped panel reads its own v backwards. */
  flipV: boolean;
}

/** The texture a painted side's panel shows, or null when it has none (not
 *  placed on a slab, that slab has no photo yet, or it no longer fits there —
 *  the same reasons a real piece's own top face would show none). */
export function resolvePanelTexture(
  piece: Pick<Piece, 'id' | 'outline'>,
  edgeIndex: number,
  measurementMm: number,
  placement: SlabPlacement | undefined,
  photos: Record<string, SlabPhoto>,
  placeables: SlabPlaceable[],
  flipV: boolean,
): PanelTexture | null {
  if (!placement) return null;
  const photo = photos[placement.slabId];
  if (!photo) return null;
  const localOutline = attachedProfileLocalOutline(piece.outline, edgeIndex, measurementMm);
  if (!localOutline) return null;
  const fit = slabFit(
    placedOutline({ outline: localOutline }, placement), photo,
    othersOnSlab(placeables, placement.slabId, profilePlaceableId(piece.id, edgeIndex)),
  );
  if (fit !== 'fits') return null;
  return {
    ...photo,
    localOutline: localOutline as [Point, Point, Point, Point],
    offset: slabOffset({ outline: localOutline }, placement),
    slabRotationDeg: placement.rotationDeg,
    flipV,
  };
}

/** A point on a panel's own visible face, given where it falls along the
 *  painted side (`lengthFraction`, 0 at the side's start to 1 at its end) and
 *  up the panel's own height (`heightFraction`, 0 at its base to 1 at its
 *  top) — mapped onto the slab photo exactly the way slabUv maps a point on a
 *  piece's own top face, just starting from this unfolded local point instead
 *  of a world one. */
export function panelSlabUv(lengthFraction: number, heightFraction: number, texture: PanelTexture): [number, number] {
  const v = texture.flipV ? 1 - heightFraction : heightFraction;
  const [nearStart, nearEnd, farEnd, farStart] = texture.localOutline;
  const near = { x: nearStart.x + (nearEnd.x - nearStart.x) * lengthFraction, y: nearStart.y + (nearEnd.y - nearStart.y) * lengthFraction };
  const far = { x: farStart.x + (farEnd.x - farStart.x) * lengthFraction, y: farStart.y + (farEnd.y - farStart.y) * lengthFraction };
  const local = { x: near.x + (far.x - near.x) * v, y: near.y + (far.y - near.y) * v };
  const rad = (texture.slabRotationDeg * Math.PI) / 180;
  const flipped = { x: local.x, y: -local.y };
  const x = flipped.x * Math.cos(rad) - flipped.y * Math.sin(rad) + texture.offset.x;
  const y = flipped.x * Math.sin(rad) + flipped.y * Math.cos(rad) + texture.offset.y;
  return [x / texture.lengthMm, 1 - y / texture.widthMm];
}
