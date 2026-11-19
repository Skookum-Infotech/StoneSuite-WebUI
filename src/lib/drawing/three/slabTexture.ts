// Putting a slab's photo on a piece's top face. A piece laid on a slab in the Material tab
// is cut from one rectangle of that slab; the photo is mapped so the 3D top face shows
// exactly that stone, the same mapping the 2D board uses (slabs.ts `slabOffset`):
//   slabPoint = rotateClockwise(flipY(local), placement.rotationDeg) + offset.

import type { Piece, Point, SlabPlacement } from '@/types/drawing';
import { toLocalPoint } from '../geometry';
import { othersOnSlab, placedOutline, slabFit, slabOffset } from '../slabs';

/** What the viewer needs of a slab that has a photo. */
export interface SlabPhoto {
  photoUrl: string;
  lengthMm: number;
  widthMm: number;
}

export interface PieceTexture extends SlabPhoto {
  /** Slab-space shift from `slabOffset`. */
  offset: Point;
  slabRotationDeg: number;
  piecePosition: Point;
  pieceRotationDeg: number;
}

/** Why a piece does or does not show a slab photo:
 *  none    - not laid on any slab
 *  missing - laid on a slab whose photo is not available (none uploaded, or not loaded yet)
 *  misfit  - runs off the slab or overlaps another piece (a photo of stone it would not be
 *            cut from would mislead, so it keeps the plain stone colour)
 *  ready   - shows the photo */
export type SlabPhotoStatus = 'none' | 'missing' | 'misfit' | 'ready';

export interface ResolvedTexture {
  status: SlabPhotoStatus;
  texture: PieceTexture | null;
}

export function resolveTexture(
  piece: Piece, allPieces: Piece[], photos: Record<string, SlabPhoto>,
): ResolvedTexture {
  const placement: SlabPlacement | undefined = piece.slab;
  if (!placement) return { status: 'none', texture: null };
  const photo = photos[placement.slabId];
  if (!photo) return { status: 'missing', texture: null };
  const fit = slabFit(placedOutline(piece, placement), photo, othersOnSlab(allPieces, placement.slabId, piece.id));
  if (fit !== 'fits') return { status: 'misfit', texture: null };
  return {
    status: 'ready',
    texture: {
      ...photo,
      offset: slabOffset(piece, placement),
      slabRotationDeg: placement.rotationDeg,
      piecePosition: piece.position,
      pieceRotationDeg: piece.rotationDeg,
    },
  };
}

/** The texture for a piece, or null when it has none to show (see `SlabPhotoStatus`). */
export function pieceTexture(
  piece: Piece, allPieces: Piece[], photos: Record<string, SlabPhoto>,
): PieceTexture | null {
  return resolveTexture(piece, allPieces, photos).texture;
}

/** Texture coordinates (0..1, v up from the image's bottom) of a world point on the piece's top face. */
export function slabUv(world: Point, texture: PieceTexture): [number, number] {
  const local = toLocalPoint(world, texture.piecePosition, texture.pieceRotationDeg);
  const rad = (texture.slabRotationDeg * Math.PI) / 180;
  const flipped = { x: local.x, y: -local.y };
  const x = flipped.x * Math.cos(rad) - flipped.y * Math.sin(rad) + texture.offset.x;
  const y = flipped.x * Math.sin(rad) + flipped.y * Math.cos(rad) + texture.offset.y;
  return [x / texture.lengthMm, 1 - y / texture.widthMm];
}
