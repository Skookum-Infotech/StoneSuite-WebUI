// Every item the Material tab can lay on a slab: a real piece, and each of
// its painted Profiles sides — its own rectangle of stone, placed on a slab
// independently of the piece it is attached to. One flat list, so the slab
// fit/placement/collision logic in lib/drawing/slabs.ts treats a piece and a
// profile piece the same way instead of needing its own parallel version.

import type { AttachedProfileType, DrawingArea, PieceEdge, Point, SlabPlacement } from '@/types/drawing';
import { attachedProfileLocalOutline } from './attachedProfileGeometry';
import { edgeLetter } from './labels';

export interface SlabPlaceable {
  /** Unique across every piece and profile piece in the drawing. */
  id: string;
  areaId: string;
  pieceId: string;
  /** Absent for a real piece; the painted side's index for a profile piece. */
  edgeIndex?: number;
  label: string;
  /** Piece-local space (no position/rotation applied) — ready for
   *  lib/drawing/slabs.ts the same way Piece.outline already is. */
  outline: Point[];
  /** The parent piece's own edges, for arc flattening (lib/drawing/slabs.ts's
   *  `Placeable`) — a real piece can have a curved (bump/arc) side; a profile
   *  piece is always a plain rectangle, so it never needs this. */
  edges?: PieceEdge[];
  slab?: SlabPlacement;
}

/** The id a profile piece's placeable gets — stable across renders, and
 *  distinct from any real piece's own id (which never contains a colon). */
export function profilePlaceableId(pieceId: string, edgeIndex: number): string {
  return `${pieceId}:profile:${edgeIndex}`;
}

/** Every piece and profile piece across `areas`, flattened for the Material
 *  tab's slab picking/placement/collision logic. `types` resolves a painted
 *  side's profile type for its label, the same way attachedProfilePieces()
 *  does for the on-canvas rectangle — a side whose type is not (or not yet)
 *  in the list is left out rather than guessed at. */
export function slabPlaceables(areas: DrawingArea[], types: AttachedProfileType[]): SlabPlaceable[] {
  const typeById = new Map(types.map((t) => [t.id, t]));
  return areas.flatMap((area) => area.pieces.flatMap((piece) => [
    {
      id: piece.id, areaId: area.id, pieceId: piece.id, label: piece.label, outline: piece.outline, edges: piece.edges, slab: piece.slab,
    },
    ...piece.edges.flatMap((edge): SlabPlaceable[] => {
      const profile = edge.attachedProfile;
      const type = profile && typeById.get(profile.profileTypeId);
      if (!profile || !type) return [];
      const outline = attachedProfileLocalOutline(piece.outline, edge.index, profile.measurementMm);
      if (!outline) return [];
      return [{
        id: profilePlaceableId(piece.id, edge.index),
        areaId: area.id,
        pieceId: piece.id,
        edgeIndex: edge.index,
        label: `${piece.label} ${type.name}-${edgeLetter(edge.index)}`,
        outline,
        slab: profile.slab,
      }];
    }),
  ]));
}
